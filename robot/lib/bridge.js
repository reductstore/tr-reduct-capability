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

// Capture both streams: the bridge prints config errors on stderr.
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

// ROS env is image-specific: a writable HOME for ROS (logs to ~/.ros/log), plus
// the DDS domain and UDP transport for ROS 2 (SHM is unreachable cross-user).
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
    args.push("-e", `ROS_DOMAIN_ID=${Number(bridge.rosDomainId) || 0}`);
    args.push("-e", "FASTDDS_BUILTIN_TRANSPORTS=UDPv4");
  }
  for (const mount of bridge.mounts || []) {
    const m = (mount || "").trim();
    if (m) args.push("-v", `${m}:${m}:ro`);
  }
  // extra env last so it can override the above
  for (const e of bridge.env || []) {
    if (e && e.key) args.push("-e", `${e.key}=${e.value ?? ""}`);
  }
  args.push(bridge.image, "reduct-bridge", CONTAINER_CONFIG_PATH);
  return args;
}

// docker inspect (not ps): a crash-looping container still lists in ps, so only
// a running, non-restarting container counts as up.
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

  // Sample twice: healthy if running and the restart count stopped climbing, so
  // a transient crash that recovered is not a failure but a crash-loop is.
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
