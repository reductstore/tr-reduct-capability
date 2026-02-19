'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createCommandQueue } = require('../robot/lib/command-queue');

test('command queue executes commands sequentially', async () => {
  const order = [];
  const queue = createCommandQueue(async (action) => {
    order.push(`start:${action}`);
    await new Promise((r) => setTimeout(r, action === 'start' ? 15 : 1));
    order.push(`end:${action}`);
  });

  await Promise.all([
    queue('start', {}),
    queue('stop', {}),
    queue('restart', {})
  ]);

  assert.deepEqual(order, [
    'start:start', 'end:start',
    'start:stop', 'end:stop',
    'start:restart', 'end:restart'
  ]);
});
