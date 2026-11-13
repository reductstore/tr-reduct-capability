async function startStore({ config, store, billingToken }) {
  const persisted = store.readManagedReplications
    ? store.readManagedReplications()
    : [];
  const live = (await store.getReplications(config.store).catch(() => []))
    .filter((task) => task.is_provisioned)
    .map((task) => task.name);
  const managed = [...new Set([...persisted, ...live])];
  await store.start(config.store, { billingToken });
  if (!(await store.waitUntilAlive(config.store))) {
    throw new Error("ReductStore did not become ready in time");
  }
  const removed = (await store.pruneReplications(config.store, managed)) || [];
  store.writeManagedReplications?.(managed.filter((n) => !removed.includes(n)));
}

async function ensureStoreReady({ config, store }) {
  const status = await store.status(config.store);
  if (!status.running || !(await store.alive(config.store))) {
    throw new Error("ReductStore must be running before starting ReductBridge");
  }
}

function requiresBilling(action) {
  return !["stop-store", "stop-bridge"].includes(action);
}

function effectiveAction(action, config, startedStoreConfig) {
  if (
    ["start-bridge", "stop-bridge", "restart-bridge"].includes(action) &&
    startedStoreConfig != null &&
    JSON.stringify(config.store) !== startedStoreConfig
  ) {
    return "restart-store";
  }
  return action;
}

async function stopAll({ config, store, bridge }, { graceMs, onError } = {}) {
  const options = graceMs == null ? {} : { graceMs };
  const errors = [];
  try {
    await bridge.stop(config.bridge, options);
  } catch (error) {
    errors.push(error);
    onError?.(error);
  }
  try {
    await store.stop(config.store, options);
  } catch (error) {
    errors.push(error);
    onError?.(error);
  }
  return errors;
}

async function runComponentAction(action, options) {
  const { config, store, bridge } = options;
  switch (action) {
    case "start-store":
      await startStore(options);
      return "ReductStore started";
    case "stop-store": {
      const errors = await stopAll({ config, store, bridge });
      if (errors.length) throw errors[0];
      return "ReductStore stopped";
    }
    case "restart-store":
      await bridge.stop(config.bridge);
      await startStore(options);
      if (config.bridge.enabled) {
        await bridge.start(config.bridge, { store: config.store });
      }
      return "ReductStore restarted";
    case "start-bridge":
      await ensureStoreReady(options);
      await bridge.start(config.bridge, { store: config.store });
      return "ReductBridge started";
    case "stop-bridge":
      await bridge.stop(config.bridge);
      return "ReductBridge stopped";
    case "restart-bridge":
      await bridge.stop(config.bridge);
      await ensureStoreReady(options);
      if (config.bridge.enabled) {
        await bridge.start(config.bridge, { store: config.store });
      }
      return "ReductBridge restarted";
    default:
      throw new Error(`Unknown component action: ${action}`);
  }
}

module.exports = {
  requiresBilling,
  runComponentAction,
  effectiveAction,
  stopAll,
};
