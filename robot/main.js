const os = require("node:os");
const mqtt = require("mqtt");
const {
  MqttSync,
  getLogger,
  getPackageVersionNamespace,
} = require("@transitive-sdk/utils");
const store = require("./lib/store");
const bridge = require("./lib/bridge");
const { loadConfig, saveConfig } = require("./lib/config");
const { createBillingGate } = require("./lib/billing-gate");
const {
  verifyBillingToken,
  persistToken,
  loadPersistedToken,
  deletePersistedToken,
} = require("./lib/billing-token");
const {
  effectiveAction,
  requiresBilling,
  runComponentAction,
  stopAll,
} = require("./lib/component-actions");

const log = getLogger("reductstore-robot");
log.setLevel(process.env.LOG_LEVEL || "info");

const isStandalone = process.env.STANDALONE === "true";
const version = getPackageVersionNamespace();

let mqttSync;
let config = loadConfig();
let lastError = null;
let lastRequestId = null;
let lastBillingToken = null;
let chain = Promise.resolve();
let startedStoreConfig = null;

function enqueue(fn) {
  chain = chain.then(fn).catch((error) => log.warn(error.message));
  return chain;
}

function hasBillingEntitlement() {
  if (isStandalone) return true;
  return billingGate.status().entitled;
}

const billingGate = isStandalone
  ? null
  : createBillingGate({
      verify: (token) =>
        verifyBillingToken(token, {
          deviceId: process.env.TR_DEVICEID,
          userId: process.env.TR_USERID,
          capability: process.env.npm_package_name,
        }),
      onEntitled: () => {
        if (mqttSync && config.autoStart) {
          enqueue(() => runCommand("restart-store"));
        }
      },
      onDenied: (reason) => {
        log.info(`Transitive billing token ${reason}; stopping ReductStore`);
        enqueue(async () => {
          lastBillingToken = null;
          deletePersistedToken();
          await stopAll({ config, store, bridge });
          billingGate.dispose();
          process.exit(0);
        });
      },
    });

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
  data.update("/device/config/json", JSON.stringify(config));
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
  const billing = isStandalone
    ? { entitled: true, expiresAt: null }
    : billingGate.status();

  const data = mqttSync.data;
  data.update(
    "/device/state",
    deriveState(storeStatus, bridgeStatus, runtimeError),
  );
  if (message !== undefined) data.update("/device/message", message);
  data.update("/device/error", runtimeError || null);
  data.update("/device/billing/state", billing.entitled ? "valid" : "invalid");
  data.update("/device/billing/expiresAt", billing.expiresAt);
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

async function runCommand(action, patch) {
  try {
    if (patch && typeof patch === "object") {
      config = saveConfig(config, patch);
      publishDetails();
    }
    action = effectiveAction(action, config, startedStoreConfig);
    if (requiresBilling(action) && !hasBillingEntitlement()) {
      throw new Error("a valid Transitive billing token is required");
    }
    const message = await runComponentAction(action, {
      config,
      store,
      bridge,
      billingToken: lastBillingToken,
    });
    if (action === "start-store" || action === "restart-store") {
      startedStoreConfig = JSON.stringify(config.store);
    }
    lastError = null;
    await publishStatus(message);
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
  enqueue(() => runCommand(command.action, command.config));
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
  publishDetails();
  enqueue(() => publishStatus("config saved"));
}

function onBillingToken(token) {
  const result = billingGate.update(token);
  if (result.valid) {
    lastBillingToken = token;
    persistToken(token);
  } else {
    lastBillingToken = null;
    deletePersistedToken();
    log.warn(`invalid Transitive billing token: ${result.reason}`);
  }
  publishStatus().catch((error) => log.warn(error.message));
}

async function gracefulShutdown(signal) {
  log.info(`${signal} received, stopping native processes`);
  await stopAll(
    { config, store, bridge },
    { graceMs: 2000, onError: (error) => log.warn(error.message) },
  );
  mqttSync?.mqtt?.end?.();
  billingGate?.dispose();
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

  if (!isStandalone) {
    const persisted = loadPersistedToken();
    if (persisted) {
      if (billingGate.update(persisted).valid) {
        lastBillingToken = persisted;
      } else {
        deletePersistedToken();
        log.info(
          "persisted billing token is no longer valid, waiting for update",
        );
      }
    }
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
    mqttSync.subscribe("/config");
    mqttSync.subscribe("/billing/token");
    mqttSync.publish("/device");
    mqttSync.data.subscribePathFlat("/commands", onCommand);
    mqttSync.data.subscribePathFlat("/config", onConfig);
    if (!isStandalone) {
      mqttSync.data.subscribePathFlat("/billing/token", onBillingToken);
    }

    publishDetails();
    setInterval(
      () => publishStatus().catch((error) => log.warn(error.message)),
      5000,
    );
    await publishStatus("ready").catch((error) => log.warn(error.message));

    if (config.autoStart) {
      if (isStandalone || hasBillingEntitlement()) {
        log.info("autoStart: starting");
        enqueue(() => runCommand("restart-store"));
      } else {
        await publishStatus(
          "waiting for a valid Transitive billing token",
        ).catch(() => {});
      }
    }

    mqttSync.data.update("/device/lastBootAt", Date.now());
    log.info("reductstore capability running");
  });
}

boot();
