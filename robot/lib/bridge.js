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

// Host networking reaches ReductStore and the host ROS graph. Fast DDS is forced
// onto UDP because the container runs as a different user than the host ROS
// nodes, so its shared memory segments are not accessible and data would not
// flow (discovery still works, but messages never arrive). HOME points at a
// writable dir because the image user home is /nonexistent and ROS 2 aborts if
// it cannot create its log dir.
function buildRunArgs(bridge, tomlPath = BRIDGE_TOML_PATH) {
  const args = [
    "run",
    "-d",
    "--name",
    bridge.containerName,
    "--restart",
    "unless-stopped",
    "--network",
    "host",
    "-e",
    `ROS_DOMAIN_ID=${bridge.rosDomainId ?? 0}`,
    "-e",
    "HOME=/tmp",
    "-e",
    "FASTDDS_BUILTIN_TRANSPORTS=UDPv4",
    "-v",
    `${tomlPath}:${CONTAINER_CONFIG_PATH}:ro`,
  ];
  for (const mount of bridge.mounts || []) {
    if (mount) args.push("-v", `${mount}:${mount}:ro`);
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

async function start(bridge, runner = sh, { graceMs = 3000 } = {}) {
  if (!bridge.enabled) return stop(bridge, runner);

  await stop(bridge, runner);
  const tomlPath = writeToml(bridge);
  await runner("docker", buildRunArgs(bridge, tomlPath));

  // Give a bad config or an early crash time to surface, then confirm it stayed
  // up. A crash loop restarts the container, so a nonzero restart count is a
  // failure even if it is momentarily running again.
  if (graceMs) await new Promise((r) => setTimeout(r, graceMs));
  const result = await status(bridge, runner);
  if (!result.running || result.restartCount > 0) {
    const logs = await fetchLogs(bridge.containerName);
    await runner("docker", ["rm", "-f", bridge.containerName]).catch(() => {});
    throw new Error(
      `reduct-bridge failed to start${logs ? `:\n${logs}` : ""}`,
    );
  }
  return result;
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
