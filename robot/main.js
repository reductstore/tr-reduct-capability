const os = require("node:os");
const mqtt = require("mqtt");
const {
  MqttSync,
  getLogger,
  getPackageVersionNamespace,
} = require("@transitive-sdk/utils");
const store = require("./lib/store");
const bridge = require("./lib/bridge");
const { loadConfig, CONFIG_PATH } = require("./lib/config");

const log = getLogger("reductstore-robot");
log.setLevel(process.env.LOG_LEVEL || "info");

const isStandalone = process.env.STANDALONE === "true";
const version = getPackageVersionNamespace();

let mqttSync;
let config = loadConfig();
let lastError = null;
let lastRequestId = null;
let chain = Promise.resolve();

function enqueue(fn) {
  chain = chain.then(fn).catch((error) => log.warn(error.message));
  return chain;
}

function deriveState(storeStatus, bridgeStatus, error) {
  if (error) return "error";
  const bridgeUp = !bridgeStatus.enabled || bridgeStatus.running;
  if (storeStatus.running && bridgeUp) return "running";
  if (!storeStatus.running && !bridgeStatus.running) return "stopped";
  return "error";
}

function publishDetails() {
  if (!mqttSync) return;
  const data = mqttSync.data;
  data.update("/device/configPath", CONFIG_PATH);
  data.update("/device/store/host", os.hostname());
  data.update("/device/store/httpPort", config.store.httpPort);
  data.update("/device/bridge/enabled", !!config.bridge.enabled);
}

async function publishStatus(message) {
  if (!mqttSync) return;
  const storeStatus = await store
    .status(config.store)
    .catch((error) => ({ running: false, error: error.message }));
  const bridgeStatus = await bridge.status(config.bridge).catch((error) => ({
    running: false,
    enabled: !!config.bridge.enabled,
    error: error.message,
  }));
  const alive = storeStatus.running ? await store.alive(config.store) : false;
  const replications = alive
    ? await store.getReplications(config.store).catch(() => [])
    : [];
  const runtimeError =
    lastError ||
    storeStatus.error ||
    (config.bridge.enabled && bridgeStatus.error);

  const data = mqttSync.data;
  data.update(
    "/device/state",
    deriveState(storeStatus, bridgeStatus, runtimeError),
  );
  if (message !== undefined) data.update("/device/message", message);
  data.update("/device/error", runtimeError || null);
  data.update("/device/store/running", storeStatus.running);
  data.update("/device/store/alive", alive);
  data.update("/device/store/pid", storeStatus.pid || null);
  data.update("/device/store/error", storeStatus.error || null);
  data.update("/device/store/log", storeStatus.log || null);
  data.update("/device/store/replications", replications);
  data.update("/device/bridge/running", bridgeStatus.running);
  data.update("/device/bridge/pid", bridgeStatus.pid || null);
  data.update("/device/bridge/error", bridgeStatus.error || null);
  data.update("/device/bridge/log", bridgeStatus.log || null);
}

async function bringUp(message) {
  config = loadConfig();
  publishDetails();
  const managed = (await store.getReplications(config.store).catch(() => []))
    .filter((task) => task.is_provisioned)
    .map((task) => task.name);
  await store.start(config.store);
  const ready = await store.waitUntilAlive(config.store);
  if (!ready) throw new Error("ReductStore did not become ready in time");
  await store.pruneReplications(config.store, managed);
  if (config.bridge.enabled) {
    await bridge.start(config.bridge, { store: config.store });
  }
  lastError = null;
  await publishStatus(message);
}

async function runCommand(action) {
  try {
    if (action === "start") {
      await bringUp("started");
    } else if (action === "stop") {
      await bridge.stop(config.bridge);
      await store.stop(config.store);
      lastError = null;
      await publishStatus("stopped");
    } else if (action === "restart") {
      await bridge.stop(config.bridge);
      await bringUp("restarted");
    } else {
      log.warn(`unknown command: ${action}`);
    }
  } catch (error) {
    lastError = error.message;
    log.error(`${action} failed: ${error.message}`);
    await publishStatus(error.message).catch(() => {});
  }
}

function onCommand(value, key) {
  if (!key || key.split("/").pop() !== "request") return;
  let command;
  try {
    command = JSON.parse(value);
  } catch {
    return;
  }
  if (!command?.action || command.requestId === lastRequestId) return;
  lastRequestId = command.requestId;
  log.info(`command: ${command.action}`);
  enqueue(() => runCommand(command.action));
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
  let connectOptions;

  if (isStandalone) {
    const { startStandalone } = require("./lib/standalone");
    const broker = await startStandalone();
    log.info(`standalone: MQTT ${broker.mqttUrl}, HTTP :${broker.httpPort}`);
    connectOptions = { clientId: `standalone/${version}` };
  } else {
    connectOptions = {
      clientId: `${process.env.npm_package_name}/${version}`,
      username: JSON.stringify({ version: process.env.npm_package_version }),
      password: process.env.PASSWORD,
    };
  }

  const mqttClient = mqtt.connect(connectUrl, connectOptions);
  mqttClient.on("error", (error) => log.error(error.message));
  mqttClient.once("connect", async () => {
    mqttSync = new MqttSync({
      mqttClient,
      ignoreRetain: true,
      sliceTopic: isStandalone ? 0 : 5,
    });

    mqttSync.subscribe("/commands");
    mqttSync.publish("/device");
    mqttSync.data.subscribePathFlat("/commands", onCommand);

    publishDetails();
    setInterval(
      () => publishStatus().catch((error) => log.warn(error.message)),
      5000,
    );
    await publishStatus("ready").catch((error) => log.warn(error.message));

    if (config.autoStart) {
      log.info("autoStart: starting");
      enqueue(() => runCommand("start"));
    }

    mqttSync.data.update("/device/lastBootAt", Date.now());
    log.info(`reductstore capability running (config: ${CONFIG_PATH})`);
  });
}

boot();
