const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const CAPABILITY_HOME =
  process.env.CAPABILITY_HOME ||
  (os.homedir() === "/home/transitive"
    ? "/home/transitive"
    : path.join(os.homedir(), ".tr-reduct-capability"));
const STATE_DIR = process.env.STATE_DIR || path.join(CAPABILITY_HOME, "state");
const CONFIG_PATH =
  process.env.CONFIG_PATH || path.join(CAPABILITY_HOME, "config.json");
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

function readFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function loadConfig(filePath = CONFIG_PATH) {
  return deepMerge(defaults(), readFile(filePath));
}

function saveConfig(current, patch, filePath = CONFIG_PATH) {
  const next = deepMerge(current, patch || {});
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  const tmp = path.join(directory, `.${path.basename(filePath)}.tmp`);
  fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(tmp, filePath);
  fs.chmodSync(filePath, 0o600);
  return next;
}

module.exports = {
  CAPABILITY_HOME,
  STATE_DIR,
  CONFIG_PATH,
  BRIDGE_TOML_PATH,
  defaults,
  deepMerge,
  loadConfig,
  saveConfig,
};
