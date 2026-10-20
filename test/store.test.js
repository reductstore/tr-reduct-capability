const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const store = require("../robot/lib/store");
const { defaults } = require("../robot/lib/config");

test("buildEnvironment configures native ReductStore from its config section", () => {
  const env = store.buildEnvironment(defaults().store);
  assert.equal(env.RS_API_TOKEN, "transitive-local-token");
  assert.equal(env.RS_BUCKET_1_NAME, "robot-data");
  assert.equal(env.RS_BUCKET_1_QUOTA_TYPE, "FIFO");
  assert.equal(env.RS_BUCKET_1_QUOTA_SIZE, "1GB");
  assert.equal(env.RS_DATA_PATH, defaults().store.dataPath);
  assert.equal(env.RS_PORT, "8383");
});

test("buildEnvironment omits disabled quotas and incomplete replications", () => {
  const env = store.buildEnvironment({
    ...defaults().store,
    bucket: { name: "robot-data", quotaType: "NONE", quotaSize: "" },
    replications: [
      {
        name: "cloud",
        srcBucket: "robot-data",
        dstBucket: "archive",
        dstHost: "https://store.example",
        entries: "camera, lidar",
        mode: "paused",
      },
      { name: "incomplete", srcBucket: "robot-data" },
    ],
  });
  assert.equal(env.RS_BUCKET_1_QUOTA_TYPE, undefined);
  assert.equal(env.RS_REPLICATION_1_NAME, "cloud");
  assert.equal(env.RS_REPLICATION_1_ENTRIES, "camera,lidar");
  assert.equal(env.RS_REPLICATION_1_MODE, "paused");
  assert.equal(env.RS_REPLICATION_2_NAME, undefined);
});

test("starts, reports, and stops a detached native process", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-store-"));
  const config = {
    ...defaults().store,
    dataPath: path.join(dir, "data"),
  };
  const processOptions = {
    runtimeDir: dir,
    executable: process.execPath,
    args: ["-e", "setInterval(() => {}, 1000)"],
  };

  await store.start(config, processOptions);
  assert.equal((await store.status(config, processOptions)).running, true);
  await store.stop(config, processOptions);
  assert.equal((await store.status(config, processOptions)).running, false);
});

test("reports native process errors from its log", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-store-error-"));
  const config = {
    ...defaults().store,
  };
  const processOptions = {
    runtimeDir: dir,
    executable: process.execPath,
    args: ["-e", "console.error('store failure')"],
  };

  await store.start(config, processOptions);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const status = await store.status(config, processOptions);
  assert.equal(status.running, false);
  assert.match(status.error, /store failure/);
});

test("pruneReplications removes only managed tasks dropped from configuration", async () => {
  const deleted = [];
  const client = {
    getReplicationList: async () => [
      { name: "keep" },
      { name: "orphan" },
      { name: "manual" },
    ],
    deleteReplication: async (name) => deleted.push(name),
  };
  const removed = await store.pruneReplications(
    {
      replications: [
        { name: "keep", srcBucket: "b", dstBucket: "d", dstHost: "http://h" },
      ],
    },
    ["keep", "orphan"],
    client,
  );
  assert.deepEqual(removed, ["orphan"]);
  assert.deepEqual(deleted, ["orphan"]);
});
