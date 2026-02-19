'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('../robot/lib/reductstore-runtime');

test('buildRunArgs includes image, port and volume', () => {
  const args = runtime.buildRunArgs({
    image: 'reductstore/reductstore:latest',
    containerName: 'reductstore',
    httpPort: 8383,
    dataPath: '/tmp/data',
    authEnabled: false,
    apiToken: ''
  });

  assert.ok(args.includes('reductstore/reductstore:latest'));
  assert.ok(args.includes('8383:8383'));
  assert.ok(args.includes('/tmp/data:/data'));
});

test('buildRunArgs adds RS_API_TOKEN when enabled', () => {
  const args = runtime.buildRunArgs({
    image: 'reductstore/reductstore:latest',
    containerName: 'reductstore',
    httpPort: 8383,
    dataPath: '/tmp/data',
    authEnabled: true,
    apiToken: 'secret'
  });

  assert.ok(args.includes('RS_API_TOKEN=secret'));
});

test('status returns stopped when docker output is empty', async () => {
  const runner = async () => '';
  const st = await runtime.status({ containerName: 'abc' }, runner);
  assert.equal(st.state, 'stopped');
});
