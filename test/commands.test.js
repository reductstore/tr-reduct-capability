'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { extractActionFromKey, validateRuntimeConfigPatch } = require('../robot/lib/commands');

test('extractActionFromKey finds command action from nested key', () => {
  assert.equal(extractActionFromKey('/commands/start/requestId'), 'start');
  assert.equal(extractActionFromKey('/commands/restart/actor'), 'restart');
  assert.equal(extractActionFromKey('/commands/stop/ts'), 'stop');
});

test('extractActionFromKey rejects unsupported actions', () => {
  assert.equal(extractActionFromKey('/commands/redeploy/requestId'), null);
  assert.equal(extractActionFromKey('/foo/bar'), null);
});

test('validateRuntimeConfigPatch enforces allowlist', () => {
  assert.equal(validateRuntimeConfigPatch('httpPort', 8383), true);
  assert.equal(validateRuntimeConfigPatch('httpPort', 70000), false);
  assert.equal(validateRuntimeConfigPatch('containerName', 'ok_name-1'), true);
  assert.equal(validateRuntimeConfigPatch('containerName', 'bad name'), false);
  assert.equal(validateRuntimeConfigPatch('tokenRef', 'abc'), false);
});
