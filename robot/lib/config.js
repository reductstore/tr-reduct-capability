const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Runtime artifacts (generated bridge TOML, store data, PID and log files).
const STATE_DIR =
  process.env.STATE_DIR || path.join(os.homedir(), ".tr-reduct-capability");

// Managed configuration source. Transitive Configuration Management maintains
// ~/.transitive/config.json, the file shared across every capability sandbox,
// and this capability reads its own section from the package-name key.
const CONFIG_PATH =
  process.env.CONFIG_PATH ||
  path.join(os.homedir(), ".transitive", "config.json");
const CONFIG_KEY = process.env.CONFIG_KEY || require("../../package.json").name;

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

function loadConfig(filePath = CONFIG_PATH, key = CONFIG_KEY) {
  try {
    const file = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return deepMerge(defaults(), file[key] || {});
  } catch {
    return defaults();
  }
}

module.exports = {
  STATE_DIR,
  CONFIG_PATH,
  CONFIG_KEY,
  BRIDGE_TOML_PATH,
  defaults,
  deepMerge,
  loadConfig,
};
