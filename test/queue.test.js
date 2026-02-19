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

test('command queue continues after a failed command', async () => {
  const order = [];
  const queue = createCommandQueue(async (action) => {
    order.push(`start:${action}`);
    if (action === 'fail') throw new Error('boom');
    order.push(`end:${action}`);
  });

  await assert.rejects(queue('fail', {}));
  await queue('recover', {});

  assert.deepEqual(order, [
    'start:fail',
    'start:recover', 'end:recover'
  ]);
});
