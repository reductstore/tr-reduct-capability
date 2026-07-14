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

test("buildRunArgs provisions replications via RS_REPLICATION_<ID>_* env", () => {
  const s = joined(store.buildRunArgs({
    ...defaults().store,
    replications: [
      {
        name: "cloud", srcBucket: "robot-data", dstBucket: "d", dstHost: "http://h",
        dstToken: "tok", entries: "a, b", when: '{"&x":{"$gt":1}}', mode: "paused",
      },
      { name: "incomplete", srcBucket: "b" },
    ],
  }));
  assert.match(s, /-e RS_REPLICATION_1_NAME=cloud/);
  assert.match(s, /-e RS_REPLICATION_1_SRC_BUCKET=robot-data/);
  assert.match(s, /-e RS_REPLICATION_1_DST_BUCKET=d/);
  assert.match(s, /-e RS_REPLICATION_1_DST_HOST=http:\/\/h/);
  assert.match(s, /-e RS_REPLICATION_1_DST_TOKEN=tok/);
  assert.match(s, /-e RS_REPLICATION_1_ENTRIES=a,b/); // trimmed
  assert.match(s, /-e RS_REPLICATION_1_MODE=paused/);
  assert.doesNotMatch(s, /RS_REPLICATION_2_/); // incomplete task skipped
});

test("pruneReplications removes only managed tasks dropped from config", async () => {
  const deleted = [];
  const client = {
    getReplicationList: async () => [
      { name: "keep" }, { name: "orphan" }, { name: "manual" },
    ],
    deleteReplication: async (n) => deleted.push(n),
  };
  const removed = await store.pruneReplications(
    { replications: [{ name: "keep", srcBucket: "b", dstBucket: "d", dstHost: "http://h" }] },
    ["keep", "orphan"], // previously provisioned by the platform
    client,
  );
  assert.deepEqual(removed, ["orphan"]); // dropped from config -> pruned
  assert.deepEqual(deleted, ["orphan"]);
  assert.ok(!deleted.includes("manual")); // never provisioned by us -> kept
  assert.ok(!deleted.includes("keep")); // still in config -> kept
});

test("buildRunArgs omits optional replication env when unset", () => {
  const s = joined(store.buildRunArgs({
    ...defaults().store,
    replications: [{ name: "r", srcBucket: "b", dstBucket: "d", dstHost: "http://h" }],
  }));
  assert.match(s, /-e RS_REPLICATION_1_NAME=r/);
  assert.doesNotMatch(s, /RS_REPLICATION_1_DST_TOKEN/);
  assert.doesNotMatch(s, /RS_REPLICATION_1_ENTRIES/);
  assert.doesNotMatch(s, /RS_REPLICATION_1_WHEN/);
  assert.doesNotMatch(s, /RS_REPLICATION_1_MODE/);
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
