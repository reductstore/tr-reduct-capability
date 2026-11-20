const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  runComponentAction,
  stopAll,
} = require("../robot/lib/component-actions");

function dependencies({
  bridgeEnabled = true,
  bridgeRunning = false,
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
      async status() {
        events.push("bridge.status");
        return { running: bridgeRunning, enabled: bridgeEnabled };
      },
    },
    billingToken: "billing-token",
  };
}

test("restart-store spawns nothing new once shutdown has begun", async () => {
  const options = dependencies();
  options.shouldAbort = () => true;

  await runComponentAction("restart-store", options);

  assert.ok(!options.events.includes("store.start"));
  assert.ok(!options.events.includes("store.waitUntilAlive"));
  assert.ok(!options.events.includes("bridge.start"));
});

test("restarting ReductStore restarts its enabled bridge after Store is ready", async () => {
  const options = dependencies();

  const message = await runComponentAction("restart-store", options);

  assert.equal(message, "ReductStore restarted");
  assert.deepEqual(options.events, [
    "bridge.stop",
    "store.getReplications",
    "store.start",
    "store.waitUntilAlive",
    "store.getReplications",
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
    "store.getReplications",
    "store.pruneReplications:old",
    "store.writeManagedReplications:",
    "bridge.start",
  ]);
});

test("restart tracks replications provisioned during Store startup", async () => {
  const options = dependencies();
  options.config.store = {
    httpPort: 8383,
    replications: [{ name: "new" }],
  };
  let calls = 0;
  options.store.getReplications = async () => {
    options.events.push("store.getReplications");
    return calls++ === 0 ? [] : [{ name: "new", is_provisioned: true }];
  };
  options.store.readManagedReplications = () => [];
  options.store.pruneReplications = async (_, names) => {
    options.events.push(`store.pruneReplications:${names.join(",")}`);
    return [];
  };
  options.store.writeManagedReplications = (names) => {
    options.events.push(`store.writeManagedReplications:${names.join(",")}`);
  };

  await runComponentAction("restart-store", options);

  assert.deepEqual(options.events, [
    "bridge.stop",
    "store.getReplications",
    "store.start",
    "store.waitUntilAlive",
    "store.getReplications",
    "store.pruneReplications:",
    "store.writeManagedReplications:new",
    "bridge.start",
  ]);
});

test("restart retains a replication after its deletion fails", async () => {
  const options = dependencies();
  options.config.store = { httpPort: 8383, replications: [] };
  let calls = 0;
  options.store.getReplications = async () => {
    options.events.push("store.getReplications");
    if (calls++ === 0) throw new Error("offline");
    return [{ name: "old", is_provisioned: true }];
  };
  options.store.readManagedReplications = () => ["old"];
  options.store.pruneReplications = async (_, names) => {
    options.events.push(`store.pruneReplications:${names.join(",")}`);
    return [];
  };
  options.store.writeManagedReplications = (names) => {
    options.events.push(`store.writeManagedReplications:${names.join(",")}`);
  };

  await runComponentAction("restart-store", options);

  assert.deepEqual(options.events, [
    "bridge.stop",
    "store.getReplications",
    "store.start",
    "store.waitUntilAlive",
    "store.getReplications",
    "store.pruneReplications:old",
    "store.writeManagedReplications:old",
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

test("start brings a stopped capability up without restarting anything", async () => {
  const options = dependencies({ storeRunning: false });

  const message = await runComponentAction("start", options);

  assert.equal(message, "started");
  assert.deepEqual(options.events, [
    "store.status",
    "store.getReplications",
    "store.start",
    "store.waitUntilAlive",
    "store.getReplications",
    "store.pruneReplications:old",
    "bridge.status",
    "bridge.start",
  ]);
});

test("start revives a crashed Bridge without touching a healthy Store", async () => {
  const options = dependencies({ storeRunning: true, alive: true });

  await runComponentAction("start", options);

  assert.ok(!options.events.includes("store.start"));
  assert.ok(!options.events.includes("store.stop"));
  assert.deepEqual(options.events, [
    "store.status",
    "store.alive",
    "bridge.status",
    "bridge.start",
  ]);
});

test("start leaves a running Bridge alone", async () => {
  const options = dependencies({ bridgeRunning: true });

  await runComponentAction("start", options);

  assert.ok(!options.events.includes("bridge.start"));
  assert.ok(!options.events.includes("bridge.stop"));
});

test("start skips a disabled Bridge", async () => {
  const options = dependencies({ bridgeEnabled: false, storeRunning: false });

  await runComponentAction("start", options);

  assert.ok(options.events.includes("store.start"));
  assert.ok(!options.events.includes("bridge.start"));
});

test("start waits for a Store that is still coming up", async () => {
  const options = dependencies({ storeRunning: true, alive: false });

  await assert.rejects(
    runComponentAction("start", options),
    /ReductStore did not become ready in time/,
  );
  assert.deepEqual(options.events, [
    "store.status",
    "store.alive",
    "store.waitUntilAlive",
  ]);
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
