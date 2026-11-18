const MAX_TIMEOUT_MS = 2 ** 31 - 1;

function createBillingGate({
  verify,
  now = Date.now,
  setTimeout: schedule = setTimeout,
  clearTimeout: cancel = clearTimeout,
  onEntitled,
  onDenied,
}) {
  let timer = null;
  let entitled = false;
  let expiresAt = null;

  function clearExpiry() {
    if (timer) cancel(timer);
    timer = null;
  }

  function scheduleExpiry() {
    const delay = Math.max(0, expiresAt - now());
    timer =
      delay > MAX_TIMEOUT_MS
        ? schedule(scheduleExpiry, MAX_TIMEOUT_MS)
        : schedule(() => revoke("expired"), delay);
  }

  function revoke(reason) {
    clearExpiry();
    expiresAt = null;
    if (!entitled) return;
    entitled = false;
    onDenied(reason);
  }

  function update(token) {
    let nextExpiresAt;
    try {
      nextExpiresAt = verify(token);
    } catch (error) {
      const reason = error.message;
      revoke(reason);
      return { valid: false, reason };
    }

    clearExpiry();
    const newlyEntitled = !entitled;
    entitled = true;
    expiresAt = nextExpiresAt;
    scheduleExpiry();
    // A valid token rotation only refreshes expiry to avoid interrupting ReductStore.
    if (newlyEntitled) onEntitled();
    return { valid: true, expiresAt };
  }

  function status() {
    return { entitled, expiresAt };
  }

  function dispose() {
    clearExpiry();
  }

  return { dispose, status, update };
}

module.exports = { createBillingGate };
