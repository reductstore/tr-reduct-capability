"use strict";

const mqtt = require("mqtt");
const {
  MqttSync,
  getLogger,
  getPackageVersionNamespace,
} = require("@transitive-sdk/utils");
const storeRuntime = require("./lib/reductstore-runtime");
const bridgeRuntime = require("./lib/bridge-runtime");
const { hasBridgeInputs } = require("./lib/bridge-config");
const { createCommandDispatcher } = require("./lib/command-dispatcher");
const { createCommandQueue } = require("./lib/command-queue");
const {
  applyRuntimeConfigUpdate,
  cloneRuntimeConfig,
} = require("./lib/runtime-config");
const { loadConfig, saveConfig, CONFIG_PATH } = require("./lib/config-store");
const { createWatchdog } = require("./lib/watchdog");

const log = getLogger("reductstore-robot");
log.setLevel(process.env.LOG_LEVEL || "info");

const isStandalone = process.env.STANDALONE === "true";

const version = getPackageVersionNamespace();

let mqttSync;
let config = loadConfig(CONFIG_PATH, cloneRuntimeConfig());
let enqueueCommand;
let desiredState = "stopped";
let watchdog;

async function checkAlive(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/alive`);
    return res.ok;
  } catch {
    return false;
  }
}

function deriveOverallState(storeState, bridgeState) {
  if (storeState.state !== "running") return storeState.state || "error";
  if (!bridgeState.configured) return "running";
  if (bridgeState.state === "running") return "running";
  return "error";
}

async function publishState() {
  const storeState = await storeRuntime
    .status(config.store)
    .catch((err) => ({ state: "error", message: err.message }));
  const bridgeState = await bridgeRuntime
    .status(config)
    .catch((err) => ({
      state: "error",
      message: err.message,
      configured: hasBridgeInputs(config),
    }));
  const alive = await checkAlive(config.store.httpPort);
  mqttSync?.data.update(
    "/device/status/state",
    deriveOverallState(storeState, bridgeState),
  );
  mqttSync?.data.update(
    "/device/status/message",
    bridgeState.message || storeState.dockerStatus || storeState.message || "",
  );
  mqttSync?.data.update(
    "/device/runtime/store/containerId",
    storeState.containerId || null,
  );
  mqttSync?.data.update(
    "/device/runtime/store/state",
    storeState.state || "error",
  );
  mqttSync?.data.update("/device/runtime/store/image", config.store.image);
  mqttSync?.data.update(
    "/device/runtime/bridge/state",
    bridgeState.state || "error",
  );
  mqttSync?.data.update(
    "/device/runtime/bridge/configured",
    Boolean(bridgeState.configured),
  );
  mqttSync?.data.update(
    "/device/runtime/bridge/configPath",
    bridgeState.configPath || null,
  );
  mqttSync?.data.update("/device/runtime/bridge/pid", bridgeState.pid || null);
  mqttSync?.data.update(
    "/device/runtime/bridge/command",
    config.bridge.command,
  );
  mqttSync?.data.update(
    "/device/runtime/bridge/inputCount",
    (config.ros1.enabled ? config.ros1.topics.length : 0) +
      (config.ros2.enabled ? config.ros2.topics.length : 0),
  );
  mqttSync?.data.update("/device/health/alive", alive);
  mqttSync?.data.update("/device/health/lastCheckAt", Date.now());

  mqttSync?.data.update(
    "/device/config/runtime",
    JSON.parse(JSON.stringify(config)),
  );
}

async function executeCommand(action, payload = {}) {
  const requestId = payload.requestId || `req-${Date.now()}`;
  try {
    if (action === "start") {
      await storeRuntime.start(config.store);
      await bridgeRuntime.start(config);
      desiredState = "running";
      if (watchdog) watchdog.resetBackoff();
    } else if (action === "stop") {
      desiredState = "stopped";
      await bridgeRuntime.stop(config);
      await storeRuntime.stop(config.store);
    } else if (action === "restart") {
      await bridgeRuntime.stop(config);
      await storeRuntime.restart(config.store);
      await bridgeRuntime.start(config);
      desiredState = "running";
      if (watchdog) watchdog.resetBackoff();
    } else throw new Error(`Unsupported command: ${action}`);

    mqttSync.data.update(`/device/acks/${requestId}/status`, "ok");
    mqttSync.data.update(
      `/device/acks/${requestId}/message`,
      `${action} completed`,
    );
  } catch (error) {
    mqttSync.data.update("/device/status/state", "error");
    mqttSync.data.update("/device/status/message", error.message);
    mqttSync.data.update(`/device/acks/${requestId}/status`, "error");
    mqttSync.data.update(`/device/acks/${requestId}/message`, error.message);
  }
  mqttSync.data.update(`/device/acks/${requestId}/ts`, Date.now());
  await publishState();
}

async function gracefulShutdown(signal) {
  log.info(`${signal} received, shutting down`);
  if (watchdog) watchdog.stop();
  await bridgeRuntime
    .stop(config)
    .catch((err) => log.warn(`bridge stop: ${err.message}`));
  await storeRuntime
    .stop(config.store)
    .catch((err) => log.warn(`store stop: ${err.message}`));
  mqttSync?.close?.();
  process.exit(0);
}

process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.once("SIGINT", () => gracefulShutdown("SIGINT"));

async function boot(mqttUrl) {
  let standaloneBroker;
  if (isStandalone) {
    const { startStandalone } = require("./lib/standalone");
    standaloneBroker = await startStandalone();
    log.info(
      `standalone mode: MQTT on ${standaloneBroker.mqttUrl}, HTTP on http://localhost:${standaloneBroker.httpPort}`,
    );
  }

  const connectUrl = isStandalone
    ? "mqtt://localhost"
    : mqttUrl || "mqtt://localhost";
  const connectOpts = isStandalone
    ? { clientId: `standalone/${version}` }
    : {
        clientId: `${process.env.npm_package_name}/${version}`,
        username: JSON.stringify({ version: process.env.npm_package_version }),
        password: process.env.PASSWORD,
      };

  const mqttClient = mqtt.connect(connectUrl, connectOpts);

  mqttClient.once("connect", async () => {
    mqttSync = new MqttSync({
      mqttClient,
      ignoreRetain: true,
      sliceTopic: isStandalone ? 0 : 5,
    });
    enqueueCommand = createCommandQueue(executeCommand);

    mqttSync.subscribe("/commands");
    mqttSync.subscribe("/config/runtime");
    mqttSync.publish("/device");

    const onCommandEvent = createCommandDispatcher({
      enqueueCommand,
      logger: log,
    });

    mqttSync.data.subscribePathFlat("/commands", onCommandEvent);

    mqttSync.data.subscribePathFlat("/config/runtime", (value, key) => {
      const result = applyRuntimeConfigUpdate(config, key, value, log);
      if (result.applied) {
        saveConfig(CONFIG_PATH, config);
        log.info(`config persisted: ${result.field}`);
      }
    });

    watchdog = createWatchdog({
      getConfig: () => config,
      getDesiredState: () => desiredState,
      storeRuntime,
      bridgeRuntime,
      hasBridgeInputs,
      logger: log,
      intervalMs: 10000,
    });

    setInterval(() => {
      publishState().catch((err) => log.warn(err.message));
    }, 5000);

    await publishState().catch((err) => log.warn(err.message));

    if (config.boot.autoStartStore) {
      log.info(
        "boot: auto-starting store" +
          (config.boot.autoStartBridge ? " and bridge" : ""),
      );
      enqueueCommand("start", { actor: "boot" });
      desiredState = "running";
    }

    watchdog.start();
    mqttSync?.data.update("/device/status/lastBootAt", Date.now());
    log.info("reductstore robot capability running");
  });

  mqttClient.on("error", (err) => log.error(err.message));
}

boot();
