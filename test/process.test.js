const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const nativeProcess = require("../robot/lib/process");

test("readLog returns only the tail of a large log without reading it whole", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-log-"));
  const logPath = path.join(dir, "big.log");
  const head = "x".repeat(10000);
  fs.writeFileSync(logPath, `${head}\nTAIL MARKER\n`);

  const tail = nativeProcess.readLog(logPath, 64);
  assert.ok(tail.length <= 64);
  assert.ok(tail.endsWith("TAIL MARKER"));
  assert.ok(!tail.includes(head));
});

test("readLog returns undefined for a missing log", () => {
  assert.equal(nativeProcess.readLog("/does/not/exist.log"), undefined);
});

test("capLog truncates a log that grew past the limit", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-log-"));
  const logPath = path.join(dir, "grow.log");
  fs.writeFileSync(logPath, "y".repeat(2048));

  nativeProcess.capLog(logPath, 1024);
  assert.equal(fs.statSync(logPath).size, 0);
});

test("capLog leaves a log below the limit untouched", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-log-"));
  const logPath = path.join(dir, "small.log");
  fs.writeFileSync(logPath, "short");

  nativeProcess.capLog(logPath, 1024);
  assert.equal(fs.readFileSync(logPath, "utf8"), "short");
});
