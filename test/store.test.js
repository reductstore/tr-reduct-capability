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
  assert.match(s, /--restart unless-stopped/);
  assert.match(s, /-p 8383:8383/);
  // Run as the host user so the non-root (v1.19+) image can write the bind mount.
  assert.match(s, /--user \d+:\d+/);
  assert.equal(args[args.length - 1], "reduct/store:latest");
});

test("buildRunArgs only sets quota env when a quota type is chosen", () => {
  const base = defaults().store;
  assert.doesNotMatch(joined(store.buildRunArgs(base)), /QUOTA_TYPE/);

  const withQuota = {
    ...base,
    bucket: { name: "robot-data", quotaType: "FIFO", quotaSize: "10GB" },
  };
  const s = joined(store.buildRunArgs(withQuota));
  assert.match(s, /-e RS_BUCKET_1_QUOTA_TYPE=FIFO/);
  assert.match(s, /-e RS_BUCKET_1_QUOTA_SIZE=10GB/);
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
