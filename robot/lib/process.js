const { spawn } = require("node:child_process");
const { Buffer } = require("node:buffer");
const fs = require("node:fs");
const path = require("node:path");

const TAIL_BYTES = 4096;
const MAX_LOG_BYTES = 1024 * 1024;

function runtimePaths(runtimeDir, name) {
  return {
    logPath: path.join(runtimeDir, `${name}.log`),
    pidPath: path.join(runtimeDir, `${name}.pid`),
  };
}

function readPid(pidPath) {
  try {
    const raw = fs.readFileSync(pidPath, "utf8").trim();
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      Number.isSafeInteger(parsed.pid) &&
      parsed.pid > 0 &&
      Number.isSafeInteger(parsed.startTime)
    ) {
      return { pid: parsed.pid, startTime: parsed.startTime };
    }
    return null;
  } catch {
    return null;
  }
}

function processStartTime(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    return Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19]);
  } catch {
    return null;
  }
}

function isOwned(record) {
  return Boolean(
    record &&
    isRunning(record.pid) &&
    record.startTime != null &&
    record.startTime === processStartTime(record.pid),
  );
}

function isRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}

function readLog(logPath, maxBytes = TAIL_BYTES) {
  let fd;
  try {
    fd = fs.openSync(logPath, "r");
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - maxBytes);
    const length = size - start;
    if (length === 0) return undefined;
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, start);
    return buffer.toString("utf8").trim() || undefined;
  } catch {
    return undefined;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function capLog(logPath, maxBytes = MAX_LOG_BYTES) {
  try {
    if (fs.statSync(logPath).size > maxBytes) fs.truncateSync(logPath, 0);
  } catch {
    // no log file yet
  }
}

function status(runtimeDir, name) {
  const { logPath, pidPath } = runtimePaths(runtimeDir, name);
  const record = readPid(pidPath);
  const pid = record?.pid || null;
  const running = isOwned(record);
  if (!running && pid) fs.rmSync(pidPath, { force: true });
  const log = readLog(logPath);
  capLog(logPath);
  return {
    pid: running ? pid : null,
    running,
    log,
    error: running
      ? undefined
      : pid
        ? log || `process ${pid} exited`
        : undefined,
  };
}

function terminate(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch (err) {
    if (err.code !== "ESRCH") process.kill(pid, signal);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (isRunning(pid)) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return false;
    await sleep(Math.min(50, remaining));
  }
  return true;
}

async function stop(runtimeDir, name, { graceMs = 5000, forceMs = 5000 } = {}) {
  const { pidPath } = runtimePaths(runtimeDir, name);
  const record = readPid(pidPath);
  const pid = record?.pid;
  if (!pid || !isOwned(record)) {
    fs.rmSync(pidPath, { force: true });
    return { running: false };
  }

  terminate(pid, "SIGTERM");
  if (!(await waitForExit(pid, graceMs))) {
    terminate(pid, "SIGKILL");
    if (!(await waitForExit(pid, forceMs)))
      throw new Error(`process ${pid} did not exit after SIGKILL`);
  }
  fs.rmSync(pidPath, { force: true });
  return { running: false };
}

function start(runtimeDir, name, command, args, env) {
  const { logPath, pidPath } = runtimePaths(runtimeDir, name);
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.rmSync(pidPath, { force: true });
  fs.writeFileSync(logPath, "", "utf8");
  const log = fs.openSync(logPath, "a");

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      env,
      stdio: ["ignore", log, log],
    });
    child.once("error", (err) => {
      fs.closeSync(log);
      reject(err);
    });
    child.once("spawn", () => {
      fs.closeSync(log);
      fs.writeFileSync(
        pidPath,
        `${JSON.stringify({ pid: child.pid, startTime: processStartTime(child.pid) })}\n`,
        "utf8",
      );
      child.unref();
      resolve({ pid: child.pid, running: true });
    });
  });
}

module.exports = { runtimePaths, status, start, stop, readLog, capLog };
