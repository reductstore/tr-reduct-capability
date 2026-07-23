const { test } = require("node:test");
const assert = require("node:assert/strict");

const { computeFleetSummary } = require("../cloud/lib/fleet-summary");

const PARTS = ["@local", "reductstore", "0.1"];

function device(state, storeRunning, bridgeRunning) {
  return {
    "@local": {
      reductstore: {
        0.1: {
          device: {
            state,
            store: { running: storeRunning },
            bridge: { running: bridgeRunning },
          },
        },
      },
    },
  };
}

test("counts device states and per-component running totals", () => {
  const devices = {
    dev1: device("running", true, true),
    dev2: device("error", true, false),
    dev3: device("stopped", false, false),
    _fleet: {
      "@local": { reductstore: { 0.1: { cloud: { fleet: { total: 99 } } } } },
    },
  };

  const summary = computeFleetSummary(devices, PARTS);
  assert.equal(summary.total, 3);
  assert.equal(summary.running, 1);
  assert.equal(summary.error, 1);
  assert.equal(summary.stopped, 1);
  assert.equal(summary.storeRunning, 2);
  assert.equal(summary.bridgeRunning, 1);
});

test("ignores devices that have not reported this capability", () => {
  assert.equal(computeFleetSummary({ dev: { other: {} } }, PARTS).total, 0);
});
