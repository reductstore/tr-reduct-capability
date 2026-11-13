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
    timer = schedule(() => revoke("expired"), Math.max(0, expiresAt - now()));
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
