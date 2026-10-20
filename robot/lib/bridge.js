const fs = require("node:fs");
const path = require("node:path");
const { BRIDGE_TOML_PATH } = require("./config");
const nativeProcess = require("./process");
const { renderPreset } = require("./presets");

const BRIDGE_BINARIES = {
  "ros2-jazzy": "reduct-bridge-ros2-jazzy",
  "ros2-humble": "reduct-bridge-ros2-humble",
  ros1: "reduct-bridge-ros1",
  iot: "reduct-bridge-iot",
};

function binaryName(bridge) {
  const binary = BRIDGE_BINARIES[bridge.variant];
  if (!binary)
    throw new Error(`Unsupported ReductBridge variant: ${bridge.variant}`);
  return binary;
}

function executable(bridge, options = {}) {
  return (
    options.executable || path.join(__dirname, "..", "bin", binaryName(bridge))
  );
}

function runtimeDir(options = {}) {
  return options.runtimeDir || path.dirname(BRIDGE_TOML_PATH);
}

function tomlPath(options = {}) {
  return options.tomlPath || BRIDGE_TOML_PATH;
}

function writeToml(bridge, filePath = BRIDGE_TOML_PATH, store) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const toml = bridge.toml?.trim()
    ? bridge.toml
    : renderPreset(bridge.preset, store, bridge.variant);
  fs.writeFileSync(filePath, toml, "utf8");
  return filePath;
}

function buildEnvironment(bridge) {
  const env = {};
  if (bridge.variant === "ros1" || bridge.variant.startsWith("ros2-")) {
    env.HOME = "/tmp";
  }
  if (bridge.variant.startsWith("ros2-")) {
    env.ROS_DOMAIN_ID = String(bridge.rosDomainId ?? 0);
    env.FASTDDS_BUILTIN_TRANSPORTS = "UDPv4";
  }
  for (const variable of bridge.env || []) {
    if (variable?.key) env[variable.key] = variable.value ?? "";
  }
  return env;
}

function assertExecutable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
  } catch {
    throw new Error(
      `ReductBridge binary is unavailable at ${file}. Reinstall the capability.`,
    );
  }
}

async function status(bridge, options) {
  const state = nativeProcess.status(runtimeDir(options), "reduct-bridge");
  return { enabled: !!bridge.enabled, ...state };
}

async function stop(bridge, options) {
  return nativeProcess.stop(runtimeDir(options), "reduct-bridge", options);
}

async function start(bridge, options = {}) {
  await stop(bridge, options);
  if (!bridge.enabled) return { enabled: false, running: false };
  const filePath = writeToml(bridge, tomlPath(options), options.store);
  const command = executable(bridge, options);
  assertExecutable(command);
  return nativeProcess.start(
    runtimeDir(options),
    "reduct-bridge",
    command,
    options.args || [filePath],
    { ...process.env, ...buildEnvironment(bridge) },
  );
}

module.exports = {
  BRIDGE_BINARIES,
  binaryName,
  buildEnvironment,
  writeToml,
  status,
  stop,
  start,
};
