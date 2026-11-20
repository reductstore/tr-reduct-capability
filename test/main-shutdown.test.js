const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

test("SIGTERM shutdown logs native stop failures and exits nonzero", () => {
  const fixture = path.join(__dirname, "fixtures", "shutdown-failure.js");
  const result = spawnSync(process.execPath, [fixture], { encoding: "utf8" });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /native stop failed/);
});

test("SIGTERM shutdown waits for an in-flight action before stopping", () => {
  const fixture = path.join(__dirname, "fixtures", "shutdown-ordering.js");
  const result = spawnSync(process.execPath, [fixture], {
    encoding: "utf8",
    timeout: 5000,
  });

  assert.equal(result.status, 0);
  const started = result.stderr.indexOf("start:start");
  const done = result.stderr.indexOf("done:start");
  const stopped = result.stderr.indexOf("stopAll");
  assert.ok(
    started >= 0 && done > started && stopped > done,
    `expected the action to finish before stopAll, got:\n${result.stderr}`,
  );
});
