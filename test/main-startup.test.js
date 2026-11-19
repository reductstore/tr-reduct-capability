const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

test("startup without entitlement stops orphaned native processes", () => {
  const fixture = path.join(__dirname, "fixtures", "startup-expired-token.js");
  const result = spawnSync(process.execPath, [fixture], {
    encoding: "utf8",
    timeout: 5000,
  });

  assert.equal(result.status, 0);
  assert.match(result.stderr, /startup-stop/);
});

test("development billing bypass keeps the capability entitled", () => {
  const fixture = path.join(__dirname, "fixtures", "startup-billing-bypass.js");
  const result = spawnSync(process.execPath, [fixture], {
    encoding: "utf8",
    timeout: 5000,
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "valid");
  assert.doesNotMatch(result.stderr, /startup-stop/);
});
