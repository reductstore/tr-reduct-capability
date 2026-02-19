'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { applyRuntimeConfigUpdate } = require('../robot/lib/runtime-config');

test('ignores root runtime key update', () => {
  const cfg = { httpPort: 8383 };
  const res = applyRuntimeConfigUpdate(cfg, '/config/runtime', { any: 1 });
  assert.equal(res.applied, false);
  assert.equal(res.reason, 'root');
  assert.equal(cfg.httpPort, 8383);
});

test('applies valid runtime field update', () => {
  const cfg = { httpPort: 8383 };
  const res = applyRuntimeConfigUpdate(cfg, '/config/runtime/httpPort', 8484);
  assert.equal(res.applied, true);
  assert.equal(cfg.httpPort, 8484);
});

test('rejects invalid runtime field update', () => {
  const cfg = { httpPort: 8383 };
  const res = applyRuntimeConfigUpdate(cfg, '/config/runtime/httpPort', 99999);
  assert.equal(res.applied, false);
  assert.equal(res.reason, 'invalid');
  assert.equal(cfg.httpPort, 8383);
});
