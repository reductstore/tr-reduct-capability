const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  runComponentAction,
  effectiveAction,
  stopAll,
} = require("../robot/lib/component-actions");

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

test("restart prunes persisted managed replications when the Store query fails offline", async () => {
  const options = dependencies();
  options.config.store = { httpPort: 8383, replications: [] };
  options.store.getReplications = async () => {
    options.events.push("store.getReplications");
    throw new Error("offline");
  };
  options.store.readManagedReplications = () => ["old"];
  options.store.pruneReplications = async (_, names) => {
    options.events.push(`store.pruneReplications:${names.join(",")}`);
    return ["old"];
  };
  options.store.writeManagedReplications = (names) => {
    options.events.push(`store.writeManagedReplications:${names.join(",")}`);
  };

  const message = await runComponentAction("restart-store", options);

  assert.equal(message, "ReductStore restarted");
  assert.deepEqual(options.events, [
    "bridge.stop",
    "store.getReplications",
    "store.start",
    "store.waitUntilAlive",
    "store.pruneReplications:old",
    "store.writeManagedReplications:",
    "bridge.start",
  ]);
});

test("stopping ReductStore stops ReductBridge first", async () => {
  const options = dependencies();

  const message = await runComponentAction("stop-store", options);

  assert.equal(message, "ReductStore stopped");
  assert.deepEqual(options.events, ["bridge.stop", "store.stop"]);
});

test("stopping ReductStore reports a Store stop failure after stopping Bridge", async () => {
  const options = dependencies();
  options.store.stop = async () => {
    options.events.push("store.stop");
    throw new Error("store boom");
  };

  await assert.rejects(runComponentAction("stop-store", options), /store boom/);
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

test("stopAll stops the Store even when stopping the Bridge fails", async () => {
  const calls = [];
  const errors = [];
  const options = {
    config: { store: {}, bridge: {} },
    store: {
      async stop() {
        calls.push("store.stop");
      },
    },
    bridge: {
      async stop() {
        calls.push("bridge.stop");
        throw new Error("bridge boom");
      },
    },
  };

  await stopAll(options, { onError: (error) => errors.push(error.message) });

  assert.deepEqual(calls, ["bridge.stop", "store.stop"]);
  assert.deepEqual(errors, ["bridge boom"]);
});

test("applying ReductBridge changes restarts the Store when its settings also changed", () => {
  const started = JSON.stringify({ httpPort: 8383 });
  const changed = { store: { httpPort: 9000 }, bridge: {} };
  assert.equal(
    effectiveAction("restart-bridge", changed, started),
    "restart-store",
  );
});

test("applying ReductBridge changes alone keeps a bridge-only restart", () => {
  const started = JSON.stringify({ httpPort: 8383 });
  const same = { store: { httpPort: 8383 }, bridge: {} };
  assert.equal(
    effectiveAction("restart-bridge", same, started),
    "restart-bridge",
  );
  assert.equal(effectiveAction("restart-bridge", same, null), "restart-bridge");
  assert.equal(effectiveAction("restart-store", same, "{}"), "restart-store");
});

test("enabling or disabling ReductBridge restarts changed Store settings", () => {
  const started = JSON.stringify({ httpPort: 8383 });
  const changed = { store: { httpPort: 9000 }, bridge: {} };

  assert.equal(
    effectiveAction("start-bridge", changed, started),
    "restart-store",
  );
  assert.equal(
    effectiveAction("stop-bridge", changed, started),
    "restart-store",
  );
});
