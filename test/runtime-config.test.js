'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { applyRuntimeConfigUpdate, cloneRuntimeConfig } = require('../robot/lib/runtime-config');

test('ignores root runtime key update', () => {
  const cfg = cloneRuntimeConfig();
  const res = applyRuntimeConfigUpdate(cfg, '/config/runtime', { any: 1 });
  assert.equal(res.applied, false);
  assert.equal(res.reason, 'root');
  assert.equal(cfg.store.httpPort, 8383);
});

test('applies valid runtime field update', () => {
  const cfg = cloneRuntimeConfig();
  const res = applyRuntimeConfigUpdate(cfg, '/config/runtime/store/httpPort', 8484);
  assert.equal(res.applied, true);
  assert.equal(cfg.store.httpPort, 8484);
});

test('rejects invalid runtime field update', () => {
  const cfg = cloneRuntimeConfig();
  const res = applyRuntimeConfigUpdate(cfg, '/config/runtime/store/httpPort', 99999);
  assert.equal(res.applied, false);
  assert.equal(res.reason, 'invalid');
  assert.equal(cfg.store.httpPort, 8383);
});

test('applies ROS topic array update', () => {
  const cfg = cloneRuntimeConfig();
  const topics = [{ name: '/scan', entryName: 'lidar' }];
  const res = applyRuntimeConfigUpdate(cfg, '/config/runtime/ros2/topics', topics);
  assert.equal(res.applied, true);
  assert.deepEqual(cfg.ros2.topics, topics);
});

test('merges section object updates instead of replacing the whole section', () => {
  const cfg = cloneRuntimeConfig();
  const res = applyRuntimeConfigUpdate(cfg, '/config/runtime/bridge', { bucket: 'fleet' });
  assert.equal(res.applied, true);
  assert.equal(cfg.bridge.bucket, 'fleet');
  assert.equal(cfg.bridge.remoteName, 'local');
});
