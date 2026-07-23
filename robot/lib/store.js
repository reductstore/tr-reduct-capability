const { execFile } = require("node:child_process");
const fs = require("node:fs");
const { Client } = require("reduct-js");

// v1.19+ images run unprivileged, so run as the uid/gid owning the data dir or
// the bind mount is not writable. Null off Linux.
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

function validReplications(store) {
  return (store.replications || []).filter(
    (r) => r && r.name && r.srcBucket && r.dstBucket && r.dstHost,
  );
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

  validReplications(store).forEach((r, i) => {
    const p = `RS_REPLICATION_${i + 1}_`;
    args.push("-e", `${p}NAME=${r.name}`);
    args.push("-e", `${p}SRC_BUCKET=${r.srcBucket}`);
    args.push("-e", `${p}DST_BUCKET=${r.dstBucket}`);
    args.push("-e", `${p}DST_HOST=${r.dstHost}`);
    if (r.dstToken) args.push("-e", `${p}DST_TOKEN=${r.dstToken}`);
    const entries = (r.entries || "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    if (entries.length) args.push("-e", `${p}ENTRIES=${entries.join(",")}`);
    if (r.when && r.when.trim()) args.push("-e", `${p}WHEN=${r.when.trim()}`);
    if (r.mode) args.push("-e", `${p}MODE=${r.mode}`);
  });

  // extra env last so it can override the above
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

async function waitUntilAlive(
  store,
  { timeoutMs = 30000, intervalMs = 1000 } = {},
) {
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
  return new Client(`http://127.0.0.1:${store.httpPort}`, {
    apiToken: store.apiToken,
  });
}

// Plain JSON (pendingRecords is a bigint).
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

async function listReplicationNames(
  client,
  { retries = 12, delayMs = 500 } = {},
) {
  for (let i = 0; i < retries; i++) {
    try {
      return (await client.getReplicationList()).map((t) => t.name);
    } catch {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return [];
}

async function pruneReplications(
  store,
  managed = [],
  client = storeClient(store),
) {
  const desired = new Set(validReplications(store).map((r) => r.name));
  const managedSet = new Set(managed);
  const removed = [];
  for (const name of await listReplicationNames(client)) {
    if (desired.has(name) || !managedSet.has(name)) continue;
    try {
      await client.deleteReplication(name);
      removed.push(name);
    } catch {
      // best effort
    }
  }
  return removed;
}

module.exports = {
  sh,
  buildRunArgs,
  status,
  alive,
  waitUntilAlive,
  start,
  stop,
  getReplications,
  pruneReplications,
};
