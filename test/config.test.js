const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  CONFIG_PATH,
  STATE_DIR,
  bridgeVariantForReleases,
  capabilityHome,
  defaults,
  deepMerge,
  loadConfig,
  readOrCreateApiToken,
  saveConfig,
} = require("../robot/lib/config");

test("defaults leave ReductBridge disabled when ROS is not detected", () => {
  const config = defaults();
  assert.match(config.store.apiToken, /^[0-9a-f]{48}$/);
  assert.equal(defaults().store.apiToken, config.store.apiToken);
  assert.equal(config.store.bucket.name, "robot-data");
  assert.equal(config.store.bucket.quotaType, "FIFO");
  assert.equal(config.store.bucket.quotaSize, "1GB");
  assert.equal(config.bridge.variant, "ros2-jazzy");
  assert.equal(config.bridge.preset, "ros2");
  assert.equal(config.bridge.toml, "");
  assert.equal(config.bridge.enabled, false);
  assert.equal(config.autoStart, true);
});

test("readOrCreateApiToken generates a unique token and persists it", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-token-"));
  const tokenPath = path.join(dir, "api-token");
  const first = readOrCreateApiToken(tokenPath);
  assert.match(first, /^[0-9a-f]{48}$/);
  assert.equal(readOrCreateApiToken(tokenPath), first);
  assert.equal(fs.readFileSync(tokenPath, "utf8").trim(), first);

  const other = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "tr-token-")),
    "api-token",
  );
  assert.notEqual(readOrCreateApiToken(other), first);
});

test("the default bridge variant follows the robot's ROS release", () => {
  assert.equal(bridgeVariantForReleases("humble"), "ros2-humble");
  assert.equal(bridgeVariantForReleases("jazzy"), "ros2-jazzy");
  assert.equal(bridgeVariantForReleases("noetic"), "ros1");
  assert.equal(bridgeVariantForReleases(""), "ros2-jazzy");
});

test("default configuration is below the capability state directory", () => {
  assert.equal(CONFIG_PATH, path.join(STATE_DIR, "config.json"));
});

test("the capability home is the persistent package root above node_modules", () => {
  assert.equal(
    capabilityHome(
      "/home/transitive/node_modules/@reductstore-tr/reductstore/robot/lib",
      {},
    ),
    "/home/transitive",
  );
});

test("CAPABILITY_HOME env overrides the derived capability home", () => {
  assert.equal(
    capabilityHome("/anywhere/node_modules/x/robot/lib", {
      CAPABILITY_HOME: "/custom/home",
    }),
    "/custom/home",
  );
});

test("the capability home falls back to the home directory outside an install", () => {
  assert.equal(
    capabilityHome("/opt/tr-reduct-capability/robot/lib", {}),
    path.join(os.homedir(), ".tr-reduct-capability"),
  );
});

test("deepMerge merges managed nested configuration without dropping siblings", () => {
  const merged = deepMerge(defaults(), { store: { apiToken: "secret" } });
  assert.equal(merged.store.apiToken, "secret");
  assert.equal(merged.store.bucket.name, "robot-data");
});

test("loadConfig reads the capability's private configuration file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-cfg-"));
  const file = path.join(dir, "config.json");
  fs.writeFileSync(
    file,
    JSON.stringify({ bridge: { enabled: true, variant: "iot" } }),
  );

  const loaded = loadConfig(file);
  assert.equal(loaded.bridge.enabled, true);
  assert.equal(loaded.bridge.variant, "iot");
  assert.equal(loaded.store.httpPort, defaults().store.httpPort);
});

test("loadConfig falls back to defaults on a corrupt private file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-cfg-"));
  const file = path.join(dir, "config.json");
  fs.writeFileSync(file, "{ not json");
  assert.deepEqual(loadConfig(file), defaults());
});

test("saveConfig atomically writes a private configuration file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-cfg-"));
  const file = path.join(dir, "config.json");

  saveConfig(defaults(), { store: { httpPort: 9000 } }, file);

  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(raw.store.httpPort, 9000);
  assert.equal(raw["@reductstore-tr/reductstore"], undefined);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(loadConfig(file).store.bucket.name, "robot-data");
});
