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

test('command queue continues after failure when follow-up already enqueued', async () => {
  const order = [];
  const queue = createCommandQueue(async (action) => {
    order.push(`start:${action}`);
    await new Promise((r) => setTimeout(r, 5));
    if (action === 'fail') throw new Error('boom');
    order.push(`end:${action}`);
  });

  const p1 = queue('fail', {});
  const p2 = queue('recover', {});

  await assert.rejects(p1);
  await p2;

  assert.deepEqual(order, [
    'start:fail',
    'start:recover', 'end:recover'
  ]);
});

test('command queue recovers after multiple failures', async () => {
  const order = [];
  const queue = createCommandQueue(async (action) => {
    order.push(`start:${action}`);
    if (action.startsWith('fail')) throw new Error('boom');
    order.push(`end:${action}`);
  });

  const p1 = queue('fail-1', {});
  const p2 = queue('fail-2', {});
  const p3 = queue('recover', {});

  await assert.rejects(p1);
  await assert.rejects(p2);
  await p3;

  assert.deepEqual(order, [
    'start:fail-1',
    'start:fail-2',
    'start:recover', 'end:recover'
  ]);
});
