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

test("caps an active log without creating a sparse file", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-log-"));
  const name = "writer";
  const { logPath } = nativeProcess.runtimePaths(dir, name);
  await nativeProcess.start(
    dir,
    name,
    process.execPath,
    [
      "-e",
      "console.error('x'.repeat(1100000)); setInterval(() => console.error('after'), 10)",
    ],
    process.env,
  );

  try {
    while (!fs.existsSync(logPath) || fs.statSync(logPath).size <= 1024 * 1024)
      await new Promise((resolve) => setTimeout(resolve, 10));
    nativeProcess.status(dir, name);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const log = fs.readFileSync(logPath, "utf8");
    assert.ok(log.length < 1024);
    assert.match(log, /after/);
  } finally {
    await nativeProcess.stop(dir, name);
  }
});

function startTimeOf(pid) {
  const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
  return Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19]);
}

function killIfRunning(pid) {
  try {
    process.kill(-pid, "SIGKILL");
    return;
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

test("stop signals the process identified by the recorded start time", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-pid-"));
  const name = "native";
  const { pidPath } = nativeProcess.runtimePaths(dir, name);
  const started = await nativeProcess.start(
    dir,
    name,
    process.execPath,
    ["-e", "setInterval(() => {}, 1000)"],
    process.env,
  );
  const pid = started.pid;
  fs.writeFileSync(
    pidPath,
    `${JSON.stringify({ pid, startTime: startTimeOf(pid) })}\n`,
  );

  try {
    await nativeProcess.stop(dir, name, { graceMs: 1000 });
    assert.throws(() => process.kill(pid, 0), /ESRCH/);
    assert.equal(fs.existsSync(pidPath), false);
  } finally {
    killIfRunning(pid);
  }
});

test("stop ignores a PID whose recorded start time no longer matches", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-pid-"));
  const name = "native";
  const { pidPath } = nativeProcess.runtimePaths(dir, name);
  const started = await nativeProcess.start(
    dir,
    name,
    process.execPath,
    ["-e", "setInterval(() => {}, 1000)"],
    process.env,
  );
  const pid = started.pid;
  fs.writeFileSync(
    pidPath,
    `${JSON.stringify({ pid, startTime: startTimeOf(pid) + 1 })}\n`,
  );

  try {
    assert.deepEqual(await nativeProcess.stop(dir, name, { graceMs: 0 }), {
      running: false,
    });
    process.kill(pid, 0);
    assert.equal(fs.existsSync(pidPath), false);
  } finally {
    process.kill(pid, "SIGKILL");
  }
});

test("waits for a forced process exit before removing its PID file", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-stop-"));
  const name = "native";
  const { pidPath } = nativeProcess.runtimePaths(dir, name);
  const started = await nativeProcess.start(
    dir,
    name,
    process.execPath,
    ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"],
    process.env,
  );
  const pid = started.pid;

  try {
    await nativeProcess.stop(dir, name, { graceMs: 0 });
    assert.throws(() => process.kill(pid, 0), /ESRCH/);
    assert.equal(fs.existsSync(pidPath), false);
  } finally {
    killIfRunning(pid);
  }
});

test("keeps its PID file when forced termination times out", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-stop-"));
  const name = "native";
  const { pidPath } = nativeProcess.runtimePaths(dir, name);
  const started = await nativeProcess.start(
    dir,
    name,
    process.execPath,
    ["-e", "setInterval(() => {}, 1000)"],
    process.env,
  );
  const pid = started.pid;
  const kill = process.kill;
  process.kill = (target, signal) => {
    if (signal === 0) return kill.call(process, target, 0);
  };

  try {
    await assert.rejects(
      nativeProcess.stop(dir, name, { graceMs: 0, forceMs: 1 }),
      /did not exit after SIGKILL/,
    );
    assert.equal(fs.existsSync(pidPath), true);
  } finally {
    process.kill = kill;
    killIfRunning(pid);
  }
});

test("capLog leaves a log below the limit untouched", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-log-"));
  const logPath = path.join(dir, "small.log");
  fs.writeFileSync(logPath, "short");

  nativeProcess.capLog(logPath, 1024);
  assert.equal(fs.readFileSync(logPath, "utf8"), "short");
});
