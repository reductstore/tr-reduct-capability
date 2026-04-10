"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { computeFleetSummary } = require("../cloud/lib/fleet-summary");

test("computes fleet summary counts from root data", () => {
  const fullName = "@reductstore/tr-reduct-capability/0.1";
  const root = {
    orgA: {
      d1: {
        [fullName]: {
          device: {
            status: { state: "running" },
            runtime: {
              store: { state: "running" },
              bridge: { state: "running", configured: true },
            },
          },
        },
      },
      d2: {
        [fullName]: {
          device: {
            status: { state: "error" },
            runtime: {
              store: { state: "error" },
              bridge: { state: "stopped", configured: true },
            },
          },
        },
      },
    },
    orgB: {
      d3: {
        [fullName]: {
          device: {
            status: { state: "running" },
            runtime: {
              store: { state: "running" },
              bridge: { state: "disabled", configured: false },
            },
          },
        },
      },
      d4: { other: true },
    },
  };

  const s = computeFleetSummary(root, fullName);
  assert.equal(s.runningCount, 2);
  assert.equal(s.errorCount, 1);
  assert.equal(s.stoppedCount, 1);

  assert.equal(s.store.running, 2);
  assert.equal(s.store.error, 1);
  assert.equal(s.store.stopped, 1);

  assert.equal(s.bridge.running, 1);
  assert.equal(s.bridge.stopped, 2);
  assert.equal(s.bridge.disabled, 1);
  assert.equal(s.bridge.error, 0);

  assert.equal(s.ingestion.configured, 2);
  assert.equal(s.ingestion.notConfigured, 2);
});
