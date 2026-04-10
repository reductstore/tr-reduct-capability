"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { createWatchdog } = require("../../robot/lib/watchdog");

describe("watchdog behavior", () => {
  it("detects stopped store and triggers restart", async () => {
    const calls = [];
    let storeState = "stopped";

    const watchdog = createWatchdog({
      getConfig: () => ({
        store: {},
        bridge: { enabled: true },
        ros1: { enabled: false, topics: [] },
        ros2: { enabled: false, topics: [] },
      }),
      getDesiredState: () => "running",
      storeRuntime: {
        status: async () => ({ state: storeState }),
        start: async () => {
          calls.push("store.start");
          storeState = "running";
        },
      },
      bridgeRuntime: {
        status: async () => ({ state: "disabled", configured: false }),
        start: async () => {
          calls.push("bridge.start");
        },
      },
      hasBridgeInputs: () => false,
      logger: { warn: () => {}, error: () => {}, info: () => {} },
      intervalMs: 50,
    });

    // Directly invoke tick
    await watchdog._tick();
    assert.ok(calls.includes("store.start"));
  });

  it("does not act when desired state is stopped", async () => {
    const calls = [];

    const watchdog = createWatchdog({
      getConfig: () => ({ store: {} }),
      getDesiredState: () => "stopped",
      storeRuntime: {
        status: async () => {
          calls.push("status");
          return { state: "stopped" };
        },
      },
      bridgeRuntime: { status: async () => ({ state: "stopped" }) },
      hasBridgeInputs: () => false,
      logger: { warn: () => {}, error: () => {}, info: () => {} },
      intervalMs: 50,
    });

    await watchdog._tick();
    assert.equal(calls.length, 0);
  });

  it("resets backoff on resetBackoff call", async () => {
    const calls = [];
    let callCount = 0;

    const watchdog = createWatchdog({
      getConfig: () => ({
        store: {},
        bridge: { enabled: false },
        ros1: { enabled: false, topics: [] },
        ros2: { enabled: false, topics: [] },
      }),
      getDesiredState: () => "running",
      storeRuntime: {
        status: async () => ({ state: "stopped" }),
        start: async () => {
          callCount += 1;
        },
      },
      bridgeRuntime: {
        status: async () => ({ state: "disabled", configured: false }),
      },
      hasBridgeInputs: () => false,
      logger: { warn: () => {}, error: () => {}, info: () => {} },
      intervalMs: 50,
    });

    // First tick should attempt restart
    await watchdog._tick();
    assert.equal(callCount, 1);

    // Second tick should be blocked by backoff
    await watchdog._tick();
    assert.equal(callCount, 1);

    // After reset, should allow immediate retry
    watchdog.resetBackoff();
    await watchdog._tick();
    assert.equal(callCount, 2);
  });

  it("detects stopped bridge and triggers bridge restart", async () => {
    const calls = [];

    const watchdog = createWatchdog({
      getConfig: () => ({
        store: {},
        bridge: { enabled: true },
        ros1: { enabled: true, topics: [{ name: "/test" }] },
        ros2: { enabled: false, topics: [] },
      }),
      getDesiredState: () => "running",
      storeRuntime: {
        status: async () => ({ state: "running" }),
      },
      bridgeRuntime: {
        status: async () => ({ state: "stopped", configured: true }),
        start: async () => {
          calls.push("bridge.start");
        },
      },
      hasBridgeInputs: () => true,
      logger: { warn: () => {}, error: () => {}, info: () => {} },
      intervalMs: 50,
    });

    await watchdog._tick();
    assert.ok(calls.includes("bridge.start"));
  });
});
