'use strict';

const { extractActionFromKey } = require('./commands');

function createCommandDispatcher({ enqueueCommand, logger, flushDelayMs = 15, maxScalarFlushAttempts = 20 }) {
  const pending = new Map();
  const timers = new Map();
  const flushAttempts = new Map();
  const lastRequestIdByAction = new Map();

  function clearPending(action) {
    const timer = timers.get(action);
    if (timer) clearTimeout(timer);
    timers.delete(action);
    pending.delete(action);
    flushAttempts.delete(action);
  }

  function shouldSkipAsDuplicate(action, payload) {
    const requestId = payload?.requestId;
    if (!requestId) return false;
    return lastRequestIdByAction.get(action) === requestId;
  }

  function dispatch(action, payload) {
    if (shouldSkipAsDuplicate(action, payload)) return;
    if (payload?.requestId) lastRequestIdByAction.set(action, payload.requestId);
    enqueueCommand(action, payload);
  }

  function scheduleFlush(action) {
    if (timers.has(action)) return;
    timers.set(action, setTimeout(() => flush(action), flushDelayMs));
  }

  function flush(action) {
    timers.delete(action);
    const payload = pending.get(action) || {};

    if (!payload.requestId) {
      const attempts = (flushAttempts.get(action) || 0) + 1;
      flushAttempts.set(action, attempts);
      if (attempts >= maxScalarFlushAttempts) {
        logger?.warn?.(`dropping incomplete scalar command for ${action}: missing requestId`);
        clearPending(action);
        return;
      }
      scheduleFlush(action);
      return;
    }

    clearPending(action);
    dispatch(action, payload);
  }

  return function onCommandEvent(value, key) {
    const action = extractActionFromKey(key);
    if (!action) return;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      clearPending(action);
      dispatch(action, value);
      return;
    }

    const parts = key.split('/').filter(Boolean);
    const idx = parts.indexOf('commands');
    const field = parts[idx + 2];
    if (!field) {
      logger?.warn?.(`ignoring malformed command key: ${key}`);
      return;
    }

    const existing = pending.get(action) || {};
    existing[field] = value;
    pending.set(action, existing);

    scheduleFlush(action);
  };
}

module.exports = { createCommandDispatcher };
