// Aggregate one org's devices into a fleet summary.
function computeFleetSummary(devices, parts) {
  const summary = {
    total: 0,
    running: 0,
    stopped: 0,
    error: 0,
    storeRunning: 0,
    bridgeRunning: 0,
  };

  for (const [deviceId, tree] of Object.entries(devices || {})) {
    if (deviceId === "_fleet") continue;
    const dev = parts.reduce((o, k) => (o == null ? o : o[k]), tree)?.device;
    if (!dev) continue;
    summary.total += 1;

    if (dev.state === "running") summary.running += 1;
    else if (dev.state === "error") summary.error += 1;
    else summary.stopped += 1;

    if (dev.store?.running) summary.storeRunning += 1;
    if (dev.bridge?.running) summary.bridgeRunning += 1;
  }

  return summary;
}

module.exports = { computeFleetSummary };
