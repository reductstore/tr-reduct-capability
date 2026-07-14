const os = require("node:os");
const mqtt = require("mqtt");
const { MqttSync, getLogger, getPackageVersionNamespace } = require("@transitive-sdk/utils");
const store = require("./lib/store");
const bridge = require("./lib/bridge");
const { loadConfig, saveConfig, CONFIG_PATH } = require("./lib/config");

const log = getLogger("reductstore-robot");
log.setLevel(process.env.LOG_LEVEL || "info");

const isStandalone = process.env.STANDALONE === "true";
const version = getPackageVersionNamespace();

let mqttSync;
let config = loadConfig();
let lastRequestId = null;
let chain = Promise.resolve();

function enqueue(fn) {
  chain = chain.then(fn).catch((err) => log.warn(err.message));
  return chain;
}

function deriveState(storeStatus, bridgeStatus) {
  const bridgeUp = !bridgeStatus.enabled || bridgeStatus.running;
  if (storeStatus.running && bridgeUp) return "running";
  if (!storeStatus.running && !bridgeStatus.running) return "stopped";
  return "error";
}

// Config fields only (no docker calls), so a slow docker never delays the UI.
function publishConfig() {
  if (!mqttSync) return;
  const d = mqttSync.data;
  d.update("/device/config/json", JSON.stringify(config));
  d.update("/device/store/image", config.store.image);
  d.update("/device/store/host", os.hostname());
  d.update("/device/store/httpPort", config.store.httpPort);
  d.update("/device/bridge/enabled", !!config.bridge.enabled);
  d.update("/device/bridge/image", config.bridge.image);
}

async function publishStatus(message) {
  if (!mqttSync) return;
  const storeStatus = await store.status(config.store).catch(() => ({ running: false }));
  const bridgeStatus = await bridge
    .status(config.bridge)
    .catch(() => ({ running: false, enabled: !!config.bridge.enabled }));
  const isAlive = storeStatus.running ? await store.alive(config.store) : false;
  const replications = isAlive ? await store.getReplications(config.store).catch(() => []) : [];

  const d = mqttSync.data;
  d.update("/device/state", deriveState(storeStatus, bridgeStatus));
  if (message !== undefined) d.update("/device/message", message);
  d.update("/device/store/running", storeStatus.running);
  d.update("/device/store/alive", isAlive);
  d.update("/device/store/containerId", storeStatus.containerId || null);
  d.update("/device/store/replications", replications);
  d.update("/device/bridge/running", bridgeStatus.running);
}

async function bringUp(message) {
  const managed = (await store.getReplications(config.store).catch(() => []))
    .filter((t) => t.is_provisioned)
    .map((t) => t.name);
  await store.start(config.store);
  const ready = await store.waitUntilAlive(config.store);
  if (!ready) throw new Error("ReductStore did not become ready in time");
  await store.pruneReplications(config.store, managed);
  if (config.bridge.enabled) await bridge.start(config.bridge);
  await publishStatus(message);
}

async function runCommand(action) {
  try {
    if (action === "start") {
      await bringUp("started");
    } else if (action === "stop") {
      await bridge.stop(config.bridge);
      await store.stop(config.store);
      await publishStatus("stopped");
    } else if (action === "restart") {
      await bridge.stop(config.bridge);
      await bringUp("restarted");
    } else {
      log.warn(`unknown command: ${action}`);
    }
  } catch (err) {
    log.error(`${action} failed: ${err.message}`);
    await publishStatus(err.message).catch(() => {});
  }
}

function onCommand(value, key) {
  if (!key || key.split("/").pop() !== "request") return;
  let cmd;
  try {
    cmd = JSON.parse(value);
  } catch {
    return;
  }
  if (!cmd || !cmd.action || cmd.requestId === lastRequestId) return;
  lastRequestId = cmd.requestId;
  log.info(`command: ${cmd.action}`);
  enqueue(() => runCommand(cmd.action));
}

function onConfig(value, key) {
  if (!key || key.split("/").pop() !== "json") return;
  let patch;
  try {
    patch = JSON.parse(value);
  } catch {
    log.warn("ignoring invalid config json");
    return;
  }
  config = saveConfig(config, patch);
  log.info("config updated");
  publishConfig();
  enqueue(() => publishStatus("config saved"));
}

async function gracefulShutdown(signal) {
  log.info(`${signal} received, shutting down`);
  mqttSync?.mqtt?.end?.();
  process.exit(0);
}

process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.once("SIGINT", () => gracefulShutdown("SIGINT"));

async function boot() {
  let connectUrl = "mqtt://localhost";
  let connectOpts = {};

  if (isStandalone) {
    const { startStandalone } = require("./lib/standalone");
    const broker = await startStandalone();
    log.info(`standalone: MQTT ${broker.mqttUrl}, HTTP :${broker.httpPort}`);
    connectOpts = { clientId: `standalone/${version}` };
  } else {
    connectOpts = {
      clientId: `${process.env.npm_package_name}/${version}`,
      username: JSON.stringify({ version: process.env.npm_package_version }),
      password: process.env.PASSWORD,
    };
  }

  const mqttClient = mqtt.connect(connectUrl, connectOpts);

  mqttClient.on("error", (err) => log.error(err.message));

  mqttClient.once("connect", async () => {
    mqttSync = new MqttSync({
      mqttClient,
      ignoreRetain: true,
      sliceTopic: isStandalone ? 0 : 5,
    });

    mqttSync.subscribe("/commands");
    mqttSync.subscribe("/config");
    mqttSync.publish("/device");

    mqttSync.data.subscribePathFlat("/commands", onCommand);
    mqttSync.data.subscribePathFlat("/config", onConfig);

    publishConfig();
    setInterval(publishConfig, 15000);
    setInterval(() => publishStatus().catch((err) => log.warn(err.message)), 5000);
    await publishStatus("ready").catch((err) => log.warn(err.message));

    if (config.autoStart) {
      log.info("autoStart: starting");
      enqueue(() => runCommand("start"));
    }

    mqttSync.data.update("/device/lastBootAt", Date.now());
    log.info(`reductstore capability running (config: ${CONFIG_PATH})`);
  });
}

boot();
