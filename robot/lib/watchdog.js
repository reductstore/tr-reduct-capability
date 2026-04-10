"use strict";

function createWatchdog({
  getConfig,
  getDesiredState,
  storeRuntime,
  bridgeRuntime,
  hasBridgeInputs,
  logger,
  intervalMs = 10000,
}) {
  let timer = null;
  let consecutiveFailures = 0;
  let backoffMs = 5000;
  let lastAttemptAt = 0;
  const MAX_FAILURES = 5;
  const BACKOFF_STEPS = [5000, 10000, 20000, 40000, 60000];

  function getBackoff() {
    return BACKOFF_STEPS[
      Math.min(consecutiveFailures, BACKOFF_STEPS.length - 1)
    ];
  }

  async function tick() {
    const desired = getDesiredState();
    if (desired !== "running") return;

    const config = getConfig();
    const now = Date.now();
    if (now - lastAttemptAt < getBackoff()) return;

    try {
      const storeState = await storeRuntime.status(config.store);
      if (storeState.state !== "running") {
        logger.warn(
          `watchdog: store is ${storeState.state}, attempting restart (attempt ${consecutiveFailures + 1}/${MAX_FAILURES})`,
        );
        lastAttemptAt = now;
        await storeRuntime.start(config.store);
        consecutiveFailures += 1;
        if (consecutiveFailures >= MAX_FAILURES) {
          logger.error("watchdog: max store restart attempts exceeded");
        }
        return;
      }

      const bridgeState = await bridgeRuntime.status(config);
      if (bridgeState.configured && bridgeState.state !== "running") {
        logger.warn(
          `watchdog: bridge is ${bridgeState.state}, attempting restart (attempt ${consecutiveFailures + 1}/${MAX_FAILURES})`,
        );
        lastAttemptAt = now;
        await bridgeRuntime.start(config);
        consecutiveFailures += 1;
        if (consecutiveFailures >= MAX_FAILURES) {
          logger.error("watchdog: max bridge restart attempts exceeded");
        }
        return;
      }

      // Both healthy — reset backoff
      if (consecutiveFailures > 0) {
        logger.info("watchdog: all components healthy, resetting backoff");
      }
      consecutiveFailures = 0;
    } catch (err) {
      consecutiveFailures += 1;
      lastAttemptAt = now;
      logger.error(`watchdog error: ${err.message}`);
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => {
      tick().catch((err) => logger.error(`watchdog tick: ${err.message}`));
    }, intervalMs);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function resetBackoff() {
    consecutiveFailures = 0;
    lastAttemptAt = 0;
  }

  return { start, stop, resetBackoff, _tick: tick };
}

module.exports = { createWatchdog };
