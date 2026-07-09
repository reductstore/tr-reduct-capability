const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const STATE_DIR = process.env.STATE_DIR || path.join(os.homedir(), ".tr-reduct-capability");
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(STATE_DIR, "config.json");
const BRIDGE_TOML_PATH = path.join(STATE_DIR, "bridge.toml");

// Keep identical to the ROS 2 template in web/reductstore-device.jsx (template
// auto-swap treats a matching TOML as unedited).
const DEFAULT_BRIDGE_TOML = `# ReductBridge config: https://www.reduct.store/docs/reduct-bridge
# Destination: the ReductStore running on this robot.
[remotes.reduct.local]
url = "http://127.0.0.1:8383"
token_api = "transitive-local-token"
bucket = "robot-data"
prefix = "bridge/"

# A ROS 2 input. Add more [inputs.ros2.<name>] sections for more sources.
[inputs.ros2.ros2_local]
node_name = "reduct_bridge"
queue_size = 128
domain_id = 0
schema_paths = ["/opt/ros/jazzy"]

[[inputs.ros2.ros2_local.topics]]
name = "/rosout"

[pipelines.ingest]
remote = "local"
inputs = ["ros2_local"]
`;

function defaults() {
  return {
    autoStart: true,
    store: {
      image: "reduct/store:latest",
      containerName: "reductstore",
      httpPort: 8383,
      dataPath: path.join(STATE_DIR, "reductstore-data"),
      apiToken: "transitive-local-token",
      bucket: { name: "robot-data", quotaType: "FIFO", quotaSize: "1GB" },
      replications: [],
      env: [],
    },
    bridge: {
      enabled: false, // operator enables it after configuring an input
      image: "reduct/bridge:main-ros2-jazzy",
      containerName: "reduct-bridge",
      rosDomainId: 0,
      mounts: [],
      env: [],
      toml: DEFAULT_BRIDGE_TOML,
    },
  };
}

function deepMerge(target, source) {
  const out = Array.isArray(target) ? [...target] : { ...target };
  for (const key of Object.keys(source || {})) {
    const value = source[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      out[key] &&
      typeof out[key] === "object" &&
      !Array.isArray(out[key])
    ) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function loadConfig(filePath = CONFIG_PATH) {
  try {
    const persisted = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return deepMerge(defaults(), persisted);
  } catch {
    return defaults();
  }
}

function saveConfig(current, patch, filePath = CONFIG_PATH) {
  const next = deepMerge(current, patch || {});
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
  return next;
}

module.exports = {
  STATE_DIR,
  CONFIG_PATH,
  BRIDGE_TOML_PATH,
  DEFAULT_BRIDGE_TOML,
  defaults,
  deepMerge,
  loadConfig,
  saveConfig,
};
