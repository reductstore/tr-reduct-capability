const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runComponentAction } = require("../robot/lib/component-actions");

function dependencies({
  bridgeEnabled = true,
  storeRunning = true,
  alive = true,
} = {}) {
  const events = [];
  return {
    events,
    config: {
      store: { httpPort: 8383 },
      bridge: { enabled: bridgeEnabled },
    },
    store: {
      async start() {
        events.push("store.start");
      },
      async stop() {
        events.push("store.stop");
      },
      async getReplications() {
        events.push("store.getReplications");
        return [{ name: "old", is_provisioned: true }];
      },
      async pruneReplications(_, names) {
        events.push(`store.pruneReplications:${names.join(",")}`);
      },
      async status() {
        events.push("store.status");
        return { running: storeRunning };
      },
      async alive() {
        events.push("store.alive");
        return alive;
      },
      async waitUntilAlive() {
        events.push("store.waitUntilAlive");
        return alive;
      },
    },
    bridge: {
      async start() {
        events.push("bridge.start");
      },
      async stop() {
        events.push("bridge.stop");
      },
    },
    billingToken: "billing-token",
  };
}

test("restarting ReductStore restarts its enabled bridge after Store is ready", async () => {
  const options = dependencies();

  const message = await runComponentAction("restart-store", options);

  assert.equal(message, "ReductStore restarted");
  assert.deepEqual(options.events, [
    "bridge.stop",
    "store.getReplications",
    "store.start",
    "store.waitUntilAlive",
    "store.pruneReplications:old",
    "bridge.start",
  ]);
});

test("stopping ReductStore stops ReductBridge first", async () => {
  const options = dependencies();

  const message = await runComponentAction("stop-store", options);

  assert.equal(message, "ReductStore stopped");
  assert.deepEqual(options.events, ["bridge.stop", "store.stop"]);
});

test("starting ReductBridge requires a live ReductStore", async () => {
  const options = dependencies({ alive: false });

  await assert.rejects(
    runComponentAction("start-bridge", options),
    /ReductStore must be running before starting ReductBridge/,
  );
  assert.deepEqual(options.events, ["store.status", "store.alive"]);
});
