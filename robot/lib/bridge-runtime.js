"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { generateBridgeConfig, hasBridgeInputs } = require("./bridge-config");

function mkdirpFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeBridgeConfig(config) {
  const rendered = generateBridgeConfig(config);
  if (!rendered) return null;
  mkdirpFor(config.bridge.configPath);
  fs.writeFileSync(config.bridge.configPath, rendered, "utf8");
  return config.bridge.configPath;
}

function readPid(pidPath) {
  try {
    return Number.parseInt(fs.readFileSync(pidPath, "utf8").trim(), 10);
  } catch {
    return null;
  }
}

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function status(config) {
  const pid = readPid(config.bridge.pidPath);
  const configured = config.bridge.enabled && hasBridgeInputs(config);
  const alive = isProcessRunning(pid);

  // Clean stale PID file
  if (pid && !alive) {
    try {
      fs.rmSync(config.bridge.pidPath, { force: true });
    } catch {}
  }

  return {
    state: configured ? (alive ? "running" : "stopped") : "disabled",
    configured,
    pid: alive ? pid : null,
    configPath: configured ? config.bridge.configPath : null,
    command: config.bridge.command,
  };
}

function waitForExit(pid, timeoutMs = 5000, pollMs = 500) {
  return new Promise((resolve) => {
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += pollMs;
      if (!isProcessRunning(pid) || elapsed >= timeoutMs) {
        clearInterval(interval);
        resolve(!isProcessRunning(pid));
      }
    }, pollMs);
  });
}

async function stop(config) {
  const pid = readPid(config.bridge.pidPath);
  if (isProcessRunning(pid)) {
    process.kill(pid, "SIGTERM");
    const exited = await waitForExit(pid, 5000);
    if (!exited && isProcessRunning(pid)) {
      process.kill(pid, "SIGKILL");
      await waitForExit(pid, 2000);
    }
  }
  fs.rmSync(config.bridge.pidPath, { force: true });
  return status(config);
}

async function start(config) {
  if (!config.bridge.enabled || !hasBridgeInputs(config)) {
    await stop(config);
    return status(config);
  }
  if (!config.store.authEnabled || !config.store.apiToken) {
    throw new Error(
      "Bridge requires ReductStore authEnabled=true with a non-empty apiToken",
    );
  }

  await stop(config);
  writeBridgeConfig(config);
  mkdirpFor(config.bridge.logPath);
  fs.mkdirSync(config.bridge.rosHome, { recursive: true });

  const logFd = fs.openSync(config.bridge.logPath, "a");
  const child = spawn(config.bridge.command, [config.bridge.configPath], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: {
      ...process.env,
      ROS_HOME: config.bridge.rosHome,
    },
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 300);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      reject(
        new Error(
          `reduct-bridge exited early (code=${code}, signal=${signal || "none"})`,
        ),
      );
    });
  });

  fs.writeFileSync(config.bridge.pidPath, `${child.pid}\n`, "utf8");
  child.unref();
  return status(config);
}

async function restart(config) {
  await stop(config);
  return start(config);
}

module.exports = {
  start,
  stop,
  restart,
  status,
  writeBridgeConfig,
};
