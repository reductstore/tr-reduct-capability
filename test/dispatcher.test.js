'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createCommandDispatcher } = require('../robot/lib/command-dispatcher');

test('dispatcher forwards object command payload immediately', async () => {
  const calls = [];
  const dispatch = createCommandDispatcher({
    enqueueCommand: (action, payload) => calls.push({ action, payload }),
    flushDelayMs: 1
  });

  dispatch({ requestId: '1', actor: 'ui' }, '/commands/start');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, 'start');
  assert.equal(calls[0].payload.requestId, '1');
});

test('dispatcher coalesces scalar leaf command fields into one command', async () => {
  const calls = [];
  const dispatch = createCommandDispatcher({
    enqueueCommand: (action, payload) => calls.push({ action, payload }),
    flushDelayMs: 5
  });

  dispatch('req-1', '/commands/restart/requestId');
  dispatch('ui', '/commands/restart/actor');
  dispatch(123, '/commands/restart/ts');

  await new Promise((r) => setTimeout(r, 15));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, 'restart');
  assert.equal(calls[0].payload.requestId, 'req-1');
  assert.equal(calls[0].payload.actor, 'ui');
  assert.equal(calls[0].payload.ts, 123);
});
