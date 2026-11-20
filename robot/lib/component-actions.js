async function startStore({ config, store, billingToken, shouldAbort }) {
  const persisted = store.readManagedReplications
    ? store.readManagedReplications()
    : [];
  const live = (await store.getReplications(config.store).catch(() => []))
    .filter((task) => task.is_provisioned)
    .map((task) => task.name);
  const managed = [...new Set([...persisted, ...live])];
  if (shouldAbort?.()) return;
  await store.start(config.store, { billingToken });
  if (!(await store.waitUntilAlive(config.store, { shouldAbort }))) {
    throw new Error("ReductStore did not become ready in time");
  }
  const provisioned = (
    await store.getReplications(config.store).catch(() => [])
  )
    .filter((task) => task.is_provisioned)
    .map((task) => task.name);
  const removed = (await store.pruneReplications(config.store, managed)) || [];
  store.writeManagedReplications?.(
    [...new Set([...managed, ...provisioned])].filter(
      (name) => !removed.includes(name),
    ),
  );
}

async function startBridge({ config, bridge, shouldAbort }) {
  if (!config.bridge.enabled || shouldAbort?.()) return;
  await bridge.start(config.bridge, { store: config.store });
}

function requiresBilling(action) {
  return action !== "stop";
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
    case "start": {
      const status = await store.status(config.store);
      if (!status.running) {
        await startStore(options);
      } else if (!(await store.alive(config.store))) {
        const ready = await store.waitUntilAlive(config.store, {
          shouldAbort: options.shouldAbort,
        });
        if (!ready) throw new Error("ReductStore did not become ready in time");
      }
      const bridgeStatus = await bridge.status(config.bridge);
      if (!bridgeStatus.running) await startBridge(options);
      return "started";
    }
    case "stop": {
      const errors = await stopAll({ config, store, bridge });
      if (errors.length) throw errors[0];
      return "stopped";
    }
    case "restart":
      await bridge.stop(config.bridge);
      await startStore(options);
      await startBridge(options);
      return "restarted";
    default:
      throw new Error(`Unknown component action: ${action}`);
  }
}

module.exports = {
  requiresBilling,
  runComponentAction,
  stopAll,
};
