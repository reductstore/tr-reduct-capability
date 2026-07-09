const { test } = require("node:test");
const assert = require("node:assert/strict");

const store = require("../robot/lib/store");
const { defaults } = require("../robot/lib/config");

function joined(args) {
  return args.join(" ");
}

test("buildRunArgs provisions the API token and bucket via RS_* env", () => {
  const args = store.buildRunArgs(defaults().store);
  const s = joined(args);
  assert.match(s, /-e RS_API_TOKEN=transitive-local-token/);
  assert.match(s, /-e RS_BUCKET_1_NAME=robot-data/);
  assert.match(s, /-e RS_BUCKET_1_QUOTA_TYPE=FIFO/); // default quota
  assert.match(s, /-e RS_BUCKET_1_QUOTA_SIZE=1GB/);
  assert.match(s, /--restart unless-stopped/);
  assert.match(s, /-p 8383:8383/);
  // Run as the host user so the non-root (v1.19+) image can write the bind mount.
  assert.match(s, /--user \d+:\d+/);
  assert.equal(args[args.length - 1], "reduct/store:latest");
});

test("buildRunArgs only sets quota env when a quota type is chosen", () => {
  const noQuota = {
    ...defaults().store,
    bucket: { name: "robot-data", quotaType: "NONE", quotaSize: "" },
  };
  assert.doesNotMatch(joined(store.buildRunArgs(noQuota)), /QUOTA_TYPE/);

  const withQuota = {
    ...defaults().store,
    bucket: { name: "robot-data", quotaType: "HARD", quotaSize: "10GB" },
  };
  const s = joined(store.buildRunArgs(withQuota));
  assert.match(s, /-e RS_BUCKET_1_QUOTA_TYPE=HARD/);
  assert.match(s, /-e RS_BUCKET_1_QUOTA_SIZE=10GB/);
});

test("replicationSettings maps config to a reduct-js ReplicationSettings", () => {
  assert.deepEqual(
    store.replicationSettings({
      srcBucket: "b", dstBucket: "d", dstHost: "http://h", dstToken: "tok",
      entries: "a, b", when: '{"&x":{"$gt":1}}',
    }),
    { srcBucket: "b", dstBucket: "d", dstHost: "http://h", entries: ["a", "b"],
      dstToken: "tok", when: { "&x": { $gt: 1 } } },
  );
});

test("reconcileReplications creates, updates, and deletes to match config", async () => {
  const calls = [];
  const client = {
    getReplicationList: async () => [
      { name: "keep", isProvisioned: false, isActive: true, pendingRecords: 0n, mode: "ENABLED" },
      { name: "stale", isProvisioned: false, isActive: true, pendingRecords: 0n, mode: "ENABLED" },
      { name: "locked", isProvisioned: true, isActive: true, pendingRecords: 0n, mode: "ENABLED" },
    ],
    createReplication: async (n) => calls.push(["create", n]),
    updateReplication: async (n) => calls.push(["update", n]),
    deleteReplication: async (n) => calls.push(["delete", n]),
  };
  const failed = await store.reconcileReplications({
    replications: [
      { name: "keep", srcBucket: "b", dstBucket: "d", dstHost: "http://h" },
      { name: "new", srcBucket: "b", dstBucket: "d", dstHost: "http://h" },
      { name: "incomplete" },
    ],
  }, client);
  assert.deepEqual(failed, []);
  assert.ok(calls.some(([m, n]) => m === "delete" && n === "stale"));
  assert.ok(!calls.some(([m, n]) => m === "delete" && n === "locked")); // provisioned untouched
  assert.ok(calls.some(([m, n]) => m === "update" && n === "keep"));
  assert.ok(calls.some(([m, n]) => m === "create" && n === "new"));
  assert.ok(!calls.some(([, n]) => n === "incomplete")); // missing fields, skipped
});

test("appends arbitrary extra env vars", () => {
  const s = joined(store.buildRunArgs({
    ...defaults().store,
    env: [{ key: "RS_LOG_LEVEL", value: "DEBUG" }, { key: "", value: "ignored" }],
  }));
  assert.match(s, /-e RS_LOG_LEVEL=DEBUG/);
  assert.doesNotMatch(s, /=ignored/);
});

test("start removes any existing container before running a fresh one", async () => {
  const calls = [];
  const runner = async (cmd, args) => {
    calls.push(args);
    if (args[0] === "ps") return "abc|Up 1s|reductstore/reductstore:latest";
    return "";
  };
  const result = await store.start(defaults().store, runner);
  assert.deepEqual(calls[0].slice(0, 2), ["rm", "-f"]);
  assert.equal(calls[1][0], "run");
  assert.equal(result.running, true);
});
