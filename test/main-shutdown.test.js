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
