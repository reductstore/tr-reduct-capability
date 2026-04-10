"use strict";

function computeFleetSummary(root, fullName) {
  let running = 0;
  let error = 0;
  let stopped = 0;
  const store = { running: 0, stopped: 0, error: 0 };
  const bridge = { running: 0, stopped: 0, error: 0, disabled: 0 };
  const ingestion = { configured: 0, notConfigured: 0 };

  for (const org of Object.values(root || {})) {
    for (const device of Object.values(org || {})) {
      const cap = device?.[fullName];
      const state = cap?.device?.status?.state;
      if (state === "running") running += 1;
      else if (state === "error") error += 1;
      else stopped += 1;

      const storeState = cap?.device?.runtime?.store?.state;
      if (storeState === "running") store.running += 1;
      else if (storeState === "error") store.error += 1;
      else store.stopped += 1;

      const bridgeState = cap?.device?.runtime?.bridge?.state;
      const bridgeConfigured = cap?.device?.runtime?.bridge?.configured;
      if (bridgeState === "disabled") bridge.disabled += 1;
      else if (bridgeState === "running") bridge.running += 1;
      else if (bridgeState === "error") bridge.error += 1;
      else bridge.stopped += 1;

      if (bridgeConfigured) ingestion.configured += 1;
      else ingestion.notConfigured += 1;
    }
  }

  return {
    runningCount: running,
    errorCount: error,
    stoppedCount: stopped,
    store,
    bridge,
    ingestion,
  };
}

module.exports = { computeFleetSummary };
