const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { BRIDGE_TOML_PATH } = require("./config");

const CONTAINER_CONFIG_PATH = "/etc/reduct-bridge/config.toml";

function sh(command, args = []) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: "utf8" }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve((stdout || "").trim());
    });
  });
}

// docker logs writes the container's stderr to our stderr, and the bridge
// prints its config errors there, so capture both streams.
function fetchLogs(name) {
  return new Promise((resolve) => {
    execFile("docker", ["logs", "--tail", "20", name], { encoding: "utf8" },
      (_err, stdout, stderr) => resolve(`${stdout || ""}${stderr || ""}`.trim()));
  });
}

function writeToml(bridge, tomlPath = BRIDGE_TOML_PATH) {
  fs.mkdirSync(path.dirname(tomlPath), { recursive: true });
  fs.writeFileSync(tomlPath, bridge.toml || "", "utf8");
  return tomlPath;
}

// Host networking reaches ReductStore and the host ROS graph. The ROS env below
// is added only for ROS images: a writable HOME (ROS logs to ~/.ros/log and the
// image user home is /nonexistent) for ROS 1 and 2, plus the DDS domain and UDP
// transport for ROS 2 (the container runs as a different user than host ROS
// nodes, so shared memory is not reachable and data would not flow).
function buildRunArgs(bridge, tomlPath = BRIDGE_TOML_PATH) {
  const image = bridge.image || "";
  const isRos = /ros/i.test(image);
  const isRos2 = /ros2/i.test(image);
  const args = [
    "run",
    "-d",
    "--name",
    bridge.containerName,
    "--restart",
    "unless-stopped",
    "--network",
    "host",
    "-v",
    `${tomlPath}:${CONTAINER_CONFIG_PATH}:ro`,
  ];
  if (isRos) args.push("-e", "HOME=/tmp");
  if (isRos2) {
    args.push("-e", `ROS_DOMAIN_ID=${bridge.rosDomainId ?? 0}`);
    args.push("-e", "FASTDDS_BUILTIN_TRANSPORTS=UDPv4");
  }
  for (const mount of bridge.mounts || []) {
    if (mount) args.push("-v", `${mount}:${mount}:ro`);
  }
  // Extra env vars, applied last so an operator can override anything above.
  for (const e of bridge.env || []) {
    if (e && e.key) args.push("-e", `${e.key}=${e.value ?? ""}`);
  }
  args.push(bridge.image, "reduct-bridge", CONTAINER_CONFIG_PATH);
  return args;
}

// Uses docker inspect, not docker ps: with the restart policy a crash looping
// container still shows in docker ps, so only State.Status running and not
// restarting counts as up. restartCount lets the caller catch a crash loop.
async function status(bridge, runner = sh) {
  const out = await runner("docker", [
    "inspect",
    "--format",
    "{{.Id}}|{{.State.Status}}|{{.State.Restarting}}|{{.RestartCount}}|{{.Config.Image}}",
    bridge.containerName,
  ]).catch(() => "");
  if (!out) {
    return { running: false, enabled: !!bridge.enabled, image: bridge.image, restartCount: 0 };
  }
  const [containerId, dockerStatus, restarting, restartCount, image] = out.split("|");
  return {
    running: dockerStatus === "running" && restarting !== "true",
    restartCount: Number(restartCount) || 0,
    dockerStatus,
    enabled: !!bridge.enabled,
    containerId,
    image,
  };
}

async function stop(bridge, runner = sh) {
  await runner("docker", ["rm", "-f", bridge.containerName]).catch(() => {});
  return { running: false, enabled: !!bridge.enabled };
}

async function start(bridge, runner = sh, { graceMs = 3000, settleMs = 2000 } = {}) {
  if (!bridge.enabled) return stop(bridge, runner);

  await stop(bridge, runner);
  const tomlPath = writeToml(bridge);
  await runner("docker", buildRunArgs(bridge, tomlPath));

  // A bad config crash-loops forever; a transient error (e.g. the store not
  // serving yet) crashes once and the restart policy recovers it. Sample twice:
  // the bridge is healthy if it is running and its restart count has stopped
  // climbing, so one early crash that recovered is not reported as a failure.
  if (graceMs) await new Promise((r) => setTimeout(r, graceMs));
  const first = await status(bridge, runner);
  if (settleMs) await new Promise((r) => setTimeout(r, settleMs));
  const second = await status(bridge, runner);

  if (!second.running || second.restartCount > first.restartCount) {
    const logs = await fetchLogs(bridge.containerName);
    await runner("docker", ["rm", "-f", bridge.containerName]).catch(() => {});
    throw new Error(
      `reduct-bridge failed to start${logs ? `:\n${logs}` : ""}`,
    );
  }
  return second;
}

module.exports = {
  sh,
  CONTAINER_CONFIG_PATH,
  writeToml,
  buildRunArgs,
  status,
  stop,
  start,
};
