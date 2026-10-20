const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  defaults,
  deepMerge,
  loadConfig,
  saveConfig,
} = require("../robot/lib/config");

test("defaults define native store settings and a ROS 2 Jazzy bridge preset", () => {
  const config = defaults();
  assert.equal(config.store.apiToken, "transitive-local-token");
  assert.equal(config.store.bucket.name, "robot-data");
  assert.equal(config.store.bucket.quotaType, "FIFO");
  assert.equal(config.store.bucket.quotaSize, "1GB");
  assert.equal(config.bridge.variant, "ros2-jazzy");
  assert.equal(config.bridge.preset, "ros2");
  assert.equal(config.bridge.toml, "");
  assert.equal(config.bridge.enabled, false);
  assert.equal(config.autoStart, true);
});

test("deepMerge merges managed nested configuration without dropping siblings", () => {
  const merged = deepMerge(defaults(), { store: { apiToken: "secret" } });
  assert.equal(merged.store.apiToken, "secret");
  assert.equal(merged.store.bucket.name, "robot-data");
});

test("loadConfig reads this capability's section from the shared transitive config", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-cfg-"));
  const file = path.join(dir, "config.json");
  const key = "@reductstore/reductstore";
  fs.writeFileSync(
    file,
    JSON.stringify({
      global: { ignored: true },
      "@transitive-robotics/webrtc-video": { bridge: { enabled: true } },
      [key]: { bridge: { enabled: true, variant: "iot" } },
    }),
  );

  const loaded = loadConfig(file, key);
  assert.equal(loaded.bridge.enabled, true);
  assert.equal(loaded.bridge.variant, "iot");
  assert.equal(loaded.store.httpPort, defaults().store.httpPort);
});

test("loadConfig falls back to defaults when the capability has no section", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-cfg-"));
  const file = path.join(dir, "config.json");
  fs.writeFileSync(file, JSON.stringify({ "@other/cap": { bridge: {} } }));
  assert.deepEqual(loadConfig(file, "@reductstore/reductstore"), defaults());
});

test("loadConfig falls back to defaults on a corrupt file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-cfg-"));
  const file = path.join(dir, "config.json");
  fs.writeFileSync(file, "{ not json");
  assert.deepEqual(loadConfig(file), defaults());
});

test("saveConfig writes our section and preserves other keys in the shared file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-cfg-"));
  const file = path.join(dir, "config.json");
  const key = "@reductstore/reductstore";
  fs.writeFileSync(
    file,
    JSON.stringify({ "@transitive-robotics/webrtc-video": { keep: true } }),
  );

  saveConfig(defaults(), { store: { httpPort: 9000 } }, file, key);

  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(raw["@transitive-robotics/webrtc-video"].keep, true);
  assert.equal(raw[key].store.httpPort, 9000);
  assert.equal(loadConfig(file, key).store.httpPort, 9000);
  assert.equal(loadConfig(file, key).store.bucket.name, "robot-data");
});
