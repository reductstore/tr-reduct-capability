const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { defaults, deepMerge, loadConfig, saveConfig } = require("../robot/lib/config");

test("defaults have store provisioning + a bridge TOML", () => {
  const c = defaults();
  assert.equal(c.store.apiToken, "transitive-local-token");
  assert.equal(c.store.bucket.name, "robot-data");
  assert.equal(c.store.bucket.quotaType, "FIFO"); // FIFO 1GB by default
  assert.equal(c.store.bucket.quotaSize, "1GB");
  assert.ok(c.bridge.toml.includes("[remotes.reduct.local]"));
  assert.ok(c.bridge.toml.includes("prefix ="));
  assert.equal(c.bridge.enabled, false); // bridge off until the operator enables it
  assert.equal(c.autoStart, true);
});

test("deepMerge merges nested objects without dropping siblings", () => {
  const merged = deepMerge(defaults(), { store: { apiToken: "secret" } });
  assert.equal(merged.store.apiToken, "secret");
  assert.equal(merged.store.bucket.name, "robot-data"); // sibling preserved
});

test("saveConfig persists a merged config and loadConfig reads it back", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-cfg-"));
  const file = path.join(dir, "config.json");
  const base = defaults();

  const saved = saveConfig(base, { bridge: { rosDomainId: 7 } }, file);
  assert.equal(saved.bridge.rosDomainId, 7);

  const loaded = loadConfig(file);
  assert.equal(loaded.bridge.rosDomainId, 7);
  assert.equal(loaded.store.image, base.store.image);
});

test("loadConfig falls back to defaults on a corrupt file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-cfg-"));
  const file = path.join(dir, "config.json");
  fs.writeFileSync(file, "{ not json");
  assert.deepEqual(loadConfig(file), defaults());
});
