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
    const pid = Number.parseInt(fs.readFileSync(pidPath, "utf8"), 10);
    return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
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
  const pid = readPid(pidPath);
  const running = isRunning(pid);
  if (!running && pid) fs.rmSync(pidPath, { force: true });
  const log = readLog(logPath);
  capLog(logPath);
  return {
    pid: running ? pid : null,
    running,
    log,
    error: running
      ? undefined
      : log || (pid ? `process ${pid} exited` : undefined),
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

async function stop(runtimeDir, name, { graceMs = 5000 } = {}) {
  const { pidPath } = runtimePaths(runtimeDir, name);
  const pid = readPid(pidPath);
  if (!pid || !isRunning(pid)) {
    fs.rmSync(pidPath, { force: true });
    return { running: false };
  }

  terminate(pid, "SIGTERM");
  const deadline = Date.now() + graceMs;
  while (isRunning(pid) && Date.now() < deadline) await sleep(50);
  if (isRunning(pid)) terminate(pid, "SIGKILL");
  fs.rmSync(pidPath, { force: true });
  return { running: false };
}

function start(runtimeDir, name, command, args, env) {
  const { logPath, pidPath } = runtimePaths(runtimeDir, name);
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.rmSync(pidPath, { force: true });
  const log = fs.openSync(logPath, "w");

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
      fs.writeFileSync(pidPath, `${child.pid}\n`, "utf8");
      child.unref();
      resolve({ pid: child.pid, running: true });
    });
  });
}

module.exports = { runtimePaths, status, start, stop, readLog, capLog };
