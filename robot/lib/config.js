const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function capabilityHome(moduleDir = __dirname, env = process.env) {
  if (env.CAPABILITY_HOME) return env.CAPABILITY_HOME;
  const marker = `${path.sep}node_modules${path.sep}`;
  const index = moduleDir.indexOf(marker);
  if (index >= 0) return moduleDir.slice(0, index);
  return path.join(os.homedir(), ".tr-reduct-capability");
}

const CAPABILITY_HOME = capabilityHome();

function transitiveRoot(
  capabilityHomePath = CAPABILITY_HOME,
  home = os.homedir(),
) {
  const marker = `${path.sep}packages${path.sep}`;
  const index = capabilityHomePath.indexOf(marker);
  return index >= 0
    ? capabilityHomePath.slice(0, index)
    : path.join(home, ".transitive");
}

const TRANSITIVE_ROOT = transitiveRoot();
const STATE_DIR =
  process.env.STATE_DIR ||
  path.join(TRANSITIVE_ROOT, "state", "@reductstore-tr", "reductstore");
const RUNTIME_DIR = process.env.RUNTIME_DIR || path.join(STATE_DIR, "run");
const CONFIG_PATH =
  process.env.CONFIG_PATH || path.join(STATE_DIR, "config.json");
const BRIDGE_TOML_PATH = path.join(RUNTIME_DIR, "bridge.toml");
const BILLING_TOKEN_PATH =
  process.env.BILLING_TOKEN_PATH || path.join(STATE_DIR, "billing-token");
const API_TOKEN_PATH =
  process.env.API_TOKEN_PATH || path.join(STATE_DIR, "api-token");

function bridgeVariantForReleases(releases) {
  const r = String(releases || "").toLowerCase();
  if (r.includes("humble")) return "ros2-humble";
  if (r.includes("jazzy")) return "ros2-jazzy";
  if (/noetic|melodic/.test(r)) return "ros1";
  return "ros2-jazzy";
}

function readOrCreateApiToken(tokenPath = API_TOKEN_PATH) {
  try {
    const existing = fs.readFileSync(tokenPath, "utf8").trim();
    if (existing) return existing;
  } catch {
    // no token persisted yet; generate one below
  }
  const token = crypto.randomBytes(24).toString("hex");
  const directory = path.dirname(tokenPath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.writeFileSync(tokenPath, `${token}\n`, { mode: 0o600 });
  return token;
}

function defaults() {
  const variant = bridgeVariantForReleases(process.env.TR_ROS_RELEASES);
  const isRos = Boolean(String(process.env.TR_ROS_RELEASES || "").trim());
  const isRos2 = variant.startsWith("ros2");
  return {
    autoStart: true,
    store: {
      httpPort: 8383,
      dataPath: path.join(STATE_DIR, "reductstore-data"),
      apiToken: readOrCreateApiToken(),
      bucket: { name: "robot-data", quotaType: "FIFO", quotaSize: "1GB" },
      replications: [],
      env: [],
    },
    bridge: {
      enabled: isRos,
      variant,
      preset: isRos2 ? "ros2" : "ros1",
      env: isRos2 ? [{ key: "ROS_DOMAIN_ID", value: "0" }] : [],
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
  RUNTIME_DIR,
  CONFIG_PATH,
  BRIDGE_TOML_PATH,
  BILLING_TOKEN_PATH,
  API_TOKEN_PATH,
  readOrCreateApiToken,
  capabilityHome,
  transitiveRoot,
  bridgeVariantForReleases,
  defaults,
  deepMerge,
  loadConfig,
  saveConfig,
};
