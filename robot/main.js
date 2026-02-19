'use strict';

const mqtt = require('mqtt');
const { MqttSync, getLogger, getPackageVersionNamespace } = require('@transitive-sdk/utils');
const runtime = require('./lib/reductstore-runtime');
const { extractActionFromKey, validateRuntimeConfigPatch } = require('./lib/commands');

const log = getLogger('reductstore-robot');
log.setLevel(process.env.LOG_LEVEL || 'info');

const version = getPackageVersionNamespace();
const mqttClient = mqtt.connect('mqtt://localhost', {
  clientId: `${process.env.npm_package_name}/${version}`,
  username: JSON.stringify({ version: process.env.npm_package_version }),
  password: process.env.PASSWORD
});

let mqttSync;
let config = { ...runtime.DEFAULTS };
let commandQueue = Promise.resolve();

async function checkAlive(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/alive`);
    return res.ok;
  } catch {
    return false;
  }
}

async function publishState() {
  const st = await runtime.status(config).catch((err) => ({ state: 'error', message: err.message }));
  const alive = await checkAlive(config.httpPort);
  mqttSync?.data.update('/device/status/state', st.state || 'error');
  mqttSync?.data.update('/device/status/message', st.dockerStatus || st.message || '');
  mqttSync?.data.update('/device/runtime/containerId', st.containerId || null);
  mqttSync?.data.update('/device/health/alive', alive);
  mqttSync?.data.update('/device/health/lastCheckAt', Date.now());
}

async function executeCommand(action, payload = {}) {
  const requestId = payload.requestId || `req-${Date.now()}`;
  try {
    if (action === 'start') await runtime.start(config);
    else if (action === 'stop') await runtime.stop(config);
    else if (action === 'restart') await runtime.restart(config);
    else throw new Error(`Unsupported command: ${action}`);

    mqttSync.data.update(`/device/acks/${requestId}/status`, 'ok');
    mqttSync.data.update(`/device/acks/${requestId}/message`, `${action} completed`);
  } catch (error) {
    mqttSync.data.update('/device/status/state', 'error');
    mqttSync.data.update('/device/status/message', error.message);
    mqttSync.data.update(`/device/acks/${requestId}/status`, 'error');
    mqttSync.data.update(`/device/acks/${requestId}/message`, error.message);
  }
  mqttSync.data.update(`/device/acks/${requestId}/ts`, Date.now());
  await publishState();
}

function enqueueCommand(action, payload) {
  commandQueue = commandQueue
    .catch(() => {})
    .then(() => executeCommand(action, payload));
}

mqttClient.once('connect', () => {
  mqttSync = new MqttSync({ mqttClient, ignoreRetain: true, sliceTopic: 5 });

  mqttSync.subscribe('/commands');
  mqttSync.publish('/device');

  mqttSync.data.subscribePathFlat('/commands', (value, key) => {
    const action = extractActionFromKey(key);
    if (!action || typeof value !== 'object' || value === null) return;
    enqueueCommand(action, value);
  });

  mqttSync.data.subscribePathFlat('/config/runtime', (value, key) => {
    const field = key.split('/').pop();
    if (!validateRuntimeConfigPatch(field, value)) {
      log.warn(`invalid runtime config ignored: ${field}`);
      return;
    }
    config[field] = value;
  });

  setInterval(() => {
    publishState().catch((err) => log.warn(err.message));
  }, 5000);

  publishState().catch((err) => log.warn(err.message));
  log.info('reductstore robot capability running');
});

mqttClient.on('error', (err) => log.error(err.message));
