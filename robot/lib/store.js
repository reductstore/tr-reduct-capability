const { execFile } = require("node:child_process");
const fs = require("node:fs");
const { Client } = require("reduct-js");

// Since v1.19 the ReductStore image runs as an unprivileged user, so run the
// container as the uid and gid that own the data dir or the bind mount is not
// writable. Returns null off Linux, where the concept does not apply.
function currentUser() {
  return typeof process.getuid === "function"
    ? `${process.getuid()}:${process.getgid()}`
    : null;
}

function sh(command, args = []) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: "utf8" }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve((stdout || "").trim());
    });
  });
}

function buildRunArgs(store) {
  const args = [
    "run",
    "-d",
    "--name",
    store.containerName,
    "--restart",
    "unless-stopped",
    "-p",
    `${store.httpPort}:8383`,
    "-v",
    `${store.dataPath}:/data`,
    "-e",
    `RS_API_TOKEN=${store.apiToken}`,
  ];

  const user = currentUser();
  if (user) args.push("--user", user);

  const bucket = store.bucket || {};
  if (bucket.name) {
    args.push("-e", `RS_BUCKET_1_NAME=${bucket.name}`);
    if (bucket.quotaType && bucket.quotaType !== "NONE") {
      args.push("-e", `RS_BUCKET_1_QUOTA_TYPE=${bucket.quotaType}`);
      if (bucket.quotaSize) {
        args.push("-e", `RS_BUCKET_1_QUOTA_SIZE=${bucket.quotaSize}`);
      }
    }
  }

  // Arbitrary extra env vars, applied last so an operator can override anything.
  for (const e of store.env || []) {
    if (e && e.key) args.push("-e", `${e.key}=${e.value ?? ""}`);
  }

  args.push(store.image);
  return args;
}

async function status(store, runner = sh) {
  const out = await runner("docker", [
    "ps",
    "--filter",
    `name=^/${store.containerName}$`,
    "--format",
    "{{.ID}}|{{.Status}}|{{.Image}}",
  ]).catch(() => "");
  if (!out) return { running: false, containerId: null, image: store.image };
  const [containerId, dockerStatus, image] = out.split("|");
  return { running: true, containerId, dockerStatus, image };
}

async function alive(store) {
  try {
    const res = await fetch(`http://127.0.0.1:${store.httpPort}/api/v1/alive`, {
      method: "HEAD",
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitUntilAlive(store, { timeoutMs = 30000, intervalMs = 1000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await alive(store)) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function stop(store, runner = sh) {
  await runner("docker", ["rm", "-f", store.containerName]).catch(() => {});
  return { running: false };
}

async function start(store, runner = sh) {
  await stop(store, runner);
  try {
    fs.mkdirSync(store.dataPath, { recursive: true });
  } catch {
    // best effort; docker will surface a real permission error
  }
  await runner("docker", buildRunArgs(store));
  return status(store, runner);
}

function storeClient(store) {
  return new Client(`http://127.0.0.1:${store.httpPort}`, { apiToken: store.apiToken });
}

// Map a config replication task to a reduct-js ReplicationSettings.
function replicationSettings(r) {
  const s = {
    srcBucket: r.srcBucket,
    dstBucket: r.dstBucket,
    dstHost: r.dstHost,
    entries: r.entries ? r.entries.split(",").map((e) => e.trim()).filter(Boolean) : [],
  };
  if (r.dstToken) s.dstToken = r.dstToken;
  if (r.when && r.when.trim()) {
    try {
      s.when = JSON.parse(r.when);
    } catch {
      // invalid JSON condition is left out; reconcile surfaces the failed task
    }
  }
  return s;
}

// Live replication status, mapped to plain JSON (pendingRecords is a bigint).
async function getReplications(store, client = storeClient(store)) {
  try {
    const list = await client.getReplicationList();
    return list.map((r) => ({
      name: r.name,
      mode: r.mode,
      is_active: r.isActive,
      is_provisioned: r.isProvisioned,
      pending_records: Number(r.pendingRecords),
    }));
  } catch {
    return [];
  }
}

// Make the store's replication tasks match config: create missing tasks, update
// existing ones, and delete tasks we manage that are no longer in config.
// Provisioned tasks are never touched. Returns the names that failed.
async function reconcileReplications(store, client = storeClient(store)) {
  const desired = (store.replications || []).filter(
    (r) => r && r.name && r.srcBucket && r.dstBucket && r.dstHost,
  );
  const desiredNames = new Set(desired.map((r) => r.name));
  const current = await getReplications(store, client);
  const currentNames = new Set(current.map((t) => t.name));
  const failed = [];

  for (const t of current) {
    if (desiredNames.has(t.name) || t.is_provisioned) continue;
    try {
      await client.deleteReplication(t.name);
    } catch {
      failed.push(t.name);
    }
  }

  for (const r of desired) {
    try {
      if (currentNames.has(r.name)) await client.updateReplication(r.name, replicationSettings(r));
      else await client.createReplication(r.name, replicationSettings(r));
    } catch {
      failed.push(r.name);
    }
  }

  return failed;
}

module.exports = {
  sh, buildRunArgs, status, alive, waitUntilAlive, start, stop,
  replicationSettings, getReplications, reconcileReplications,
};
