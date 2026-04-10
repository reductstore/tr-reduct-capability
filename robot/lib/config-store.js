"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const DEFAULT_CONFIG_DIR = path.join(os.homedir(), ".tr-reduct-capability");
const DEFAULT_CONFIG_PATH =
  process.env.CONFIG_PATH || path.join(DEFAULT_CONFIG_DIR, "config.json");

function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      out[key] &&
      typeof out[key] === "object" &&
      !Array.isArray(out[key])
    ) {
      out[key] = deepMerge(out[key], source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

function loadConfig(filePath, defaults) {
  const target = filePath || DEFAULT_CONFIG_PATH;
  try {
    const raw = fs.readFileSync(target, "utf8");
    const persisted = JSON.parse(raw);
    return deepMerge(defaults, persisted);
  } catch {
    return defaults;
  }
}

function saveConfig(filePath, config) {
  const target = filePath || DEFAULT_CONFIG_PATH;
  const dir = path.dirname(target);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2), "utf8");
  fs.renameSync(tmp, target);
}

module.exports = {
  CONFIG_PATH: DEFAULT_CONFIG_PATH,
  loadConfig,
  saveConfig,
  deepMerge,
};
