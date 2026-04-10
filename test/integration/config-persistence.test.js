"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const {
  loadConfig,
  saveConfig,
  deepMerge,
} = require("../../robot/lib/config-store");

const DEFAULTS = {
  store: { httpPort: 8383, image: "latest" },
  bridge: { enabled: true },
  boot: { autoStartStore: true },
};

describe("config-store persistence", () => {
  let tmpDir;
  let configPath;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-reduct-test-"));
    configPath = path.join(tmpDir, "config.json");
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns defaults when file does not exist", () => {
    const cfg = loadConfig(path.join(tmpDir, "nonexistent.json"), DEFAULTS);
    assert.deepStrictEqual(cfg, DEFAULTS);
  });

  it("saves and loads config round-trip", () => {
    const custom = { ...DEFAULTS, store: { httpPort: 9090, image: "custom" } };
    saveConfig(configPath, custom);
    const loaded = loadConfig(configPath, DEFAULTS);
    assert.equal(loaded.store.httpPort, 9090);
    assert.equal(loaded.store.image, "custom");
  });

  it("deep-merges persisted config over defaults", () => {
    saveConfig(configPath, { store: { httpPort: 7777 } });
    const loaded = loadConfig(configPath, DEFAULTS);
    assert.equal(loaded.store.httpPort, 7777);
    assert.equal(loaded.store.image, "latest"); // preserved from defaults
    assert.equal(loaded.bridge.enabled, true); // preserved from defaults
  });

  it("returns defaults on corrupt file", () => {
    fs.writeFileSync(configPath, "not valid json{{{", "utf8");
    const loaded = loadConfig(configPath, DEFAULTS);
    assert.deepStrictEqual(loaded, DEFAULTS);
  });

  it("atomic write does not leave partial files", () => {
    const large = { ...DEFAULTS, data: "x".repeat(10000) };
    saveConfig(configPath, large);
    const raw = fs.readFileSync(configPath, "utf8");
    assert.doesNotThrow(() => JSON.parse(raw));
  });
});

describe("deepMerge", () => {
  it("merges nested objects", () => {
    const a = { x: { a: 1, b: 2 }, y: 10 };
    const b = { x: { b: 99, c: 3 } };
    const result = deepMerge(a, b);
    assert.deepStrictEqual(result, { x: { a: 1, b: 99, c: 3 }, y: 10 });
  });

  it("replaces arrays entirely", () => {
    const a = { topics: [1, 2] };
    const b = { topics: [3] };
    const result = deepMerge(a, b);
    assert.deepStrictEqual(result.topics, [3]);
  });
});
