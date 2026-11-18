const Module = require("node:module");
const path = require("node:path");

const log = (message) => process.stderr.write(`${message}\n`);

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "mqtt") {
    return {
      connect: () => ({
        on() {},
        once(event, cb) {
          if (event === "connect") setTimeout(cb, 0);
        },
      }),
    };
  }
  if (request === "@transitive-sdk/utils") {
    const data = { update() {}, subscribePathFlat() {} };
    return {
      MqttSync: class {
        constructor() {
          this.data = data;
        }
        subscribe() {}
        publish() {}
      },
      getLogger: () => ({
        setLevel() {},
        info() {},
        warn() {},
        error() {},
      }),
      getPackageVersionNamespace: () => "0.2",
    };
  }
  if (request === "./lib/standalone") {
    return {
      startStandalone: async () => ({ mqttUrl: "mqtt://test", httpPort: 0 }),
    };
  }
  if (request === "./lib/config") {
    return {
      loadConfig: () => ({ autoStart: true, store: {}, bridge: {} }),
      saveConfig: (current) => current,
    };
  }
  if (request === "./lib/billing-gate")
    return { createBillingGate: () => ({}) };
  if (request === "./lib/billing-token") {
    return {
      verifyBillingToken() {},
      persistToken() {},
      loadPersistedToken: () => null,
      deletePersistedToken() {},
    };
  }
  if (request === "./lib/component-actions") {
    return {
      effectiveAction: (action) => action,
      requiresBilling: () => false,
      runComponentAction: async (action) => {
        log(`start:${action}`);
        await new Promise((resolve) => setTimeout(resolve, 300));
        log(`done:${action}`);
      },
      stopAll: async () => {
        log("stopAll");
        return [];
      },
    };
  }
  if (request === "./lib/store") {
    return {
      status: async () => ({ running: false }),
      alive: async () => false,
      getReplications: async () => [],
    };
  }
  if (request === "./lib/bridge") {
    return { status: async () => ({ running: false, enabled: false }) };
  }
  return load.call(this, request, parent, isMain);
};

process.env.STANDALONE = "true";
require(path.join(__dirname, "..", "..", "robot", "main.js"));
setTimeout(() => process.emit("SIGTERM"), 120);
