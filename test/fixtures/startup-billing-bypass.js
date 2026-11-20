const Module = require("node:module");
const path = require("node:path");

let billingState;
const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "mqtt") {
    return {
      connect: () => ({
        on() {},
        once(event, listener) {
          if (event === "connect") listener();
        },
      }),
    };
  }
  if (request === "@transitive-sdk/utils") {
    return {
      MqttSync: class {
        constructor() {
          this.data = {
            subscribePathFlat() {},
            update(key, value) {
              if (key !== "/device/billing/state") return;
              billingState = value;
              process.stdout.write(billingState);
              process.nextTick(() => process.exit(0));
            },
          };
        }
        subscribe() {}
        publish() {}
      },
      getLogger: () => ({ setLevel() {}, info() {}, warn() {}, error() {} }),
      getPackageVersionNamespace: () => "0.2",
    };
  }
  if (request === "./lib/config") {
    return {
      loadConfig: () => ({ autoStart: false, store: {}, bridge: {} }),
      saveConfig: (current) => current,
    };
  }
  if (request === "./lib/billing-token") {
    return {
      verifyBillingToken: () => {
        throw new Error("billing token has expired");
      },
      persistToken() {},
      loadPersistedToken: () => "expired-token",
      deletePersistedToken() {},
    };
  }
  if (request === "./lib/component-actions") {
    return {
      requiresBilling: () => true,
      runComponentAction: async () => {},
      stopAll: async () => {
        process.stderr.write("startup-stop\n");
        return [];
      },
    };
  }
  if (request === "./lib/store") {
    return {
      status: async () => ({ running: false }),
      alive: async () => false,
    };
  }
  if (request === "./lib/bridge") {
    return { status: async () => ({ running: false, enabled: false }) };
  }
  return load.call(this, request, parent, isMain);
};

process.env.TR_BILLING_BYPASS = "true";
delete process.env.STANDALONE;
require(path.join(__dirname, "..", "..", "robot", "main.js"));
