"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");

const storeRuntime = require("../../robot/lib/reductstore-runtime");

function dockerAvailable() {
  try {
    execFileSync("docker", ["info"], { encoding: "utf8", stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const TEST_CONFIG = {
  image: "reductstore/reductstore:latest",
  containerName: "tr-reduct-integration-test",
  httpPort: 18383,
  dataPath: "/tmp/tr-reduct-integration-test-data",
  authEnabled: true,
  apiToken: "test-token",
};

describe(
  "Docker store lifecycle",
  { skip: !dockerAvailable() && "Docker not available" },
  () => {
    after(async () => {
      await storeRuntime.stop(TEST_CONFIG).catch(() => {});
    });

    it("starts a container and reports running", async () => {
      const result = await storeRuntime.start(TEST_CONFIG);
      assert.equal(result.state, "running");
      assert.ok(result.containerId);
    });

    it("status reports running container", async () => {
      const result = await storeRuntime.status(TEST_CONFIG);
      assert.equal(result.state, "running");
    });

    it("stop removes container and reports stopped", async () => {
      const result = await storeRuntime.stop(TEST_CONFIG);
      assert.equal(result.state, "stopped");
    });

    it("status reports stopped after removal", async () => {
      const result = await storeRuntime.status(TEST_CONFIG);
      assert.equal(result.state, "stopped");
    });

    it("restart transitions through stop to running", async () => {
      const result = await storeRuntime.restart(TEST_CONFIG);
      assert.equal(result.state, "running");
    });
  },
);
