const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const STATE_DIR =
  process.env.STATE_DIR || path.join(os.homedir(), ".tr-reduct-capability");
const CONFIG_PATH =
  process.env.CONFIG_PATH || path.join(STATE_DIR, "config.json");
const BRIDGE_TOML_PATH = path.join(STATE_DIR, "bridge.toml");

function defaults() {
  return {
    autoStart: true,
    store: {
      httpPort: 8383,
      dataPath: path.join(STATE_DIR, "reductstore-data"),
      apiToken: "transitive-local-token",
      bucket: { name: "robot-data", quotaType: "FIFO", quotaSize: "1GB" },
      replications: [],
      env: [],
    },
    bridge: {
      enabled: false,
      variant: "ros2-jazzy",
      preset: "ros2",
      rosDomainId: 0,
      env: [],
      toml: "",
    },
  };
}

function deepMerge(target, source) {
  const output = Array.isArray(target) ? [...target] : { ...target };
  for (const key of Object.keys(source || {})) {
    const value = source[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === "object" &&
      !Array.isArray(output[key])
    ) {
      output[key] = deepMerge(output[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function loadConfig(filePath = CONFIG_PATH) {
  try {
    const managed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return deepMerge(defaults(), managed);
  } catch {
    return defaults();
  }
}

module.exports = {
  STATE_DIR,
  CONFIG_PATH,
  BRIDGE_TOML_PATH,
  defaults,
  deepMerge,
  loadConfig,
};
