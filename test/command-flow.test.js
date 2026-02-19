'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('../robot/lib/reductstore-runtime');

test('restart executes stop then start sequence', async () => {
  const calls = [];
  const runner = async (cmd, args) => {
    calls.push([cmd, ...args]);
    if (args[0] === 'ps') return '';
    return 'ok';
  };

  await runtime.restart({ containerName: 'reductstore' }, runner);

  const flat = calls.map((c) => c.slice(1, 3).join(' '));
  assert.ok(flat.includes('rm -f'));
  assert.ok(flat.includes('run -d'));
});
