'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeFleetSummary } = require('../cloud/lib/fleet-summary');

test('computes fleet summary counts from root data', () => {
  const fullName = '@reductstore/tr-reduct-capability/0.1';
  const root = {
    orgA: {
      d1: { [fullName]: { device: { status: { state: 'running' } } } },
      d2: { [fullName]: { device: { status: { state: 'error' } } } }
    },
    orgB: {
      d3: { [fullName]: { device: { status: { state: 'running' } } } },
      d4: { other: true }
    }
  };

  const s = computeFleetSummary(root, fullName);
  assert.equal(s.runningCount, 2);
  assert.equal(s.errorCount, 1);
});
