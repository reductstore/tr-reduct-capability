"use strict";

const ALLOWED_ACTIONS = new Set(["start", "stop", "restart"]);
const LEGACY_STORE_FIELDS = new Set([
  "image",
  "containerName",
  "httpPort",
  "dataPath",
  "authEnabled",
  "apiToken",
]);

function extractActionFromKey(key) {
  if (!key || typeof key !== "string") return null;
  const parts = key.split("/").filter(Boolean);
  const idx = parts.indexOf("commands");
  if (idx < 0 || idx + 1 >= parts.length) return null;
  const action = parts[idx + 1];
  return ALLOWED_ACTIONS.has(action) ? action : null;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isAbsolutePath(value) {
  return isNonEmptyString(value) && value.startsWith("/");
}

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

function isLabelRule(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.field || value.label)
    return isNonEmptyString(value.field) && isNonEmptyString(value.label);
  if (value.static) {
    return (
      value.static &&
      typeof value.static === "object" &&
      !Array.isArray(value.static) &&
      Object.keys(value.static).length > 0 &&
      Object.values(value.static).every((entry) => isNonEmptyString(entry))
    );
  }
  return false;
}

function isTopic(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    isNonEmptyString(value.name) &&
    (value.entryName === undefined || isNonEmptyString(value.entryName)) &&
    (value.labels === undefined ||
      (Array.isArray(value.labels) && value.labels.every(isLabelRule)))
  );
}

function validateRuntimeConfigPatch(pathOrField, value) {
  const rawSegments = Array.isArray(pathOrField)
    ? pathOrField
    : String(pathOrField || "")
        .split("/")
        .filter(Boolean);
  const segments =
    rawSegments[0] === "runtime" ? rawSegments.slice(1) : rawSegments.slice();
  if (segments.length === 0) return false;

  if (segments.length === 1 && LEGACY_STORE_FIELDS.has(segments[0])) {
    segments.unshift("store");
  }

  const pathKey = segments.join(".");
  const validators = {
    "store.image": isNonEmptyString,
    "store.containerName": (v) =>
      isNonEmptyString(v) && /^[a-zA-Z0-9_.-]+$/.test(v),
    "store.httpPort": (v) => Number.isInteger(v) && v > 0 && v < 65536,
    "store.dataPath": isAbsolutePath,
    "store.authEnabled": (v) => typeof v === "boolean",
    "store.apiToken": (v) => typeof v === "string",
    "bridge.enabled": (v) => typeof v === "boolean",
    "bridge.command": isNonEmptyString,
    "bridge.configPath": isAbsolutePath,
    "bridge.logPath": isAbsolutePath,
    "bridge.pidPath": isAbsolutePath,
    "bridge.rosHome": isAbsolutePath,
    "bridge.remoteName": isNonEmptyString,
    "bridge.bucket": isNonEmptyString,
    "bridge.prefix": isNonEmptyString,
    "bridge.batchMaxRecords": isPositiveInt,
    "bridge.batchMaxSizeBytes": isPositiveInt,
    "bridge.batchMaxIntervalMs": isPositiveInt,
    "ros1.enabled": (v) => typeof v === "boolean",
    "ros1.inputName": isNonEmptyString,
    "ros1.uri": isNonEmptyString,
    "ros1.nodeName": isNonEmptyString,
    "ros1.queueSize": isPositiveInt,
    "ros1.topics": (v) => Array.isArray(v) && v.every(isTopic),
    "ros2.enabled": (v) => typeof v === "boolean",
    "ros2.inputName": isNonEmptyString,
    "ros2.domainId": (v) => Number.isInteger(v) && v >= 0,
    "ros2.nodeName": isNonEmptyString,
    "ros2.queueSize": isPositiveInt,
    "ros2.schemaPaths": (v) => Array.isArray(v) && v.every(isAbsolutePath),
    "ros2.topics": (v) => Array.isArray(v) && v.every(isTopic),
    "boot.autoStartStore": (v) => typeof v === "boolean",
    "boot.autoStartBridge": (v) => typeof v === "boolean",
  };

  if (segments.length === 1) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return false;
    return Object.entries(value).every(([key, entry]) =>
      validateRuntimeConfigPatch([segments[0], key], entry),
    );
  }

  const validator = validators[pathKey];
  return Boolean(validator && validator(value));
}

module.exports = {
  ALLOWED_ACTIONS,
  extractActionFromKey,
  validateRuntimeConfigPatch,
};
