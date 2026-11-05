const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("reduct-js");
const nativeProcess = require("./process");

const STORE_BINARY = path.join(__dirname, "..", "bin", "reductstore");

function validReplications(store) {
  return (store.replications || []).filter(
    (replication) =>
      replication &&
      replication.name &&
      replication.srcBucket &&
      replication.dstBucket &&
      replication.dstHost,
  );
}

function buildEnvironment(store, { billingToken } = {}) {
  const env = {
    RS_API_TOKEN: store.apiToken,
    RS_DATA_PATH: store.dataPath,
    RS_PORT: String(store.httpPort),
  };
  const bucket = store.bucket || {};
  if (bucket.name) {
    env.RS_BUCKET_1_NAME = bucket.name;
    if (bucket.quotaType && bucket.quotaType !== "NONE") {
      env.RS_BUCKET_1_QUOTA_TYPE = bucket.quotaType;
      if (bucket.quotaSize) env.RS_BUCKET_1_QUOTA_SIZE = bucket.quotaSize;
    }
  }
  validReplications(store).forEach((replication, index) => {
    const prefix = `RS_REPLICATION_${index + 1}_`;
    env[`${prefix}NAME`] = replication.name;
    env[`${prefix}SRC_BUCKET`] = replication.srcBucket;
    env[`${prefix}DST_BUCKET`] = replication.dstBucket;
    env[`${prefix}DST_HOST`] = replication.dstHost;
    if (replication.dstToken) env[`${prefix}DST_TOKEN`] = replication.dstToken;
    const entries = (replication.entries || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (entries.length) env[`${prefix}ENTRIES`] = entries.join(",");
    if (replication.when?.trim())
      env[`${prefix}WHEN`] = replication.when.trim();
    if (replication.mode) env[`${prefix}MODE`] = replication.mode;
  });
  for (const variable of store.env || []) {
    if (variable?.key) env[variable.key] = variable.value ?? "";
  }
  if (billingToken) env.RS_TRANSITIVE_BILLING_TOKEN = billingToken;
  return env;
}

function runtimeDir(store, options = {}) {
  return options.runtimeDir || path.dirname(store.dataPath);
}

function executable(options = {}) {
  return options.executable || STORE_BINARY;
}

function assertExecutable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
  } catch {
    throw new Error(
      `ReductStore binary is unavailable at ${file}. Reinstall the capability.`,
    );
  }
}

async function status(store, options) {
  return nativeProcess.status(runtimeDir(store, options), "reductstore");
}

async function alive(store) {
  try {
    const response = await fetch(
      `http://127.0.0.1:${store.httpPort}/api/v1/alive`,
      { method: "HEAD" },
    );
    return response.ok;
  } catch {
    return false;
  }
}

async function waitUntilAlive(
  store,
  { timeoutMs = 30000, intervalMs = 1000 } = {},
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await alive(store)) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

async function stop(store, options) {
  return nativeProcess.stop(runtimeDir(store, options), "reductstore", options);
}

async function start(store, options = {}) {
  await stop(store, options);
  fs.mkdirSync(store.dataPath, { recursive: true });
  const command = executable(options);
  assertExecutable(command);
  return nativeProcess.start(
    runtimeDir(store, options),
    "reductstore",
    command,
    options.args || [],
    { ...process.env, ...buildEnvironment(store, options) },
  );
}

function storeClient(store) {
  return new Client(`http://127.0.0.1:${store.httpPort}`, {
    apiToken: store.apiToken,
  });
}

async function getReplications(store, client = storeClient(store)) {
  try {
    const list = await client.getReplicationList();
    return list.map((replication) => ({
      name: replication.name,
      mode: replication.mode,
      is_active: replication.isActive,
      is_provisioned: replication.isProvisioned,
      pending_records: Number(replication.pendingRecords),
    }));
  } catch {
    return [];
  }
}

async function listReplicationNames(
  client,
  { retries = 12, delayMs = 500 } = {},
) {
  for (let index = 0; index < retries; index++) {
    try {
      return (await client.getReplicationList()).map((task) => task.name);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return [];
}

async function pruneReplications(
  store,
  managed = [],
  client = storeClient(store),
) {
  const desired = new Set(validReplications(store).map((task) => task.name));
  const managedSet = new Set(managed);
  const removed = [];
  for (const name of await listReplicationNames(client)) {
    if (desired.has(name) || !managedSet.has(name)) continue;
    try {
      await client.deleteReplication(name);
      removed.push(name);
    } catch {
      continue;
    }
  }
  return removed;
}

module.exports = {
  buildEnvironment,
  status,
  alive,
  waitUntilAlive,
  start,
  stop,
  getReplications,
  pruneReplications,
};
