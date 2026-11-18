const Module = require("node:module");
const path = require("node:path");

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "mqtt") return { connect: () => ({ on() {}, once() {} }) };
  if (request === "@transitive-sdk/utils") {
    return {
      MqttSync: class {},
      getLogger: () => ({
        setLevel() {},
        info() {},
        warn: (message) => process.stderr.write(`${message}\n`),
        error() {},
      }),
      getPackageVersionNamespace: () => "0.2",
    };
  }
  if (request === "./lib/config") {
    return {
      loadConfig: () => ({ autoStart: true, store: {}, bridge: {} }),
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
      effectiveAction: (action) => action,
      requiresBilling: () => true,
      runComponentAction: async () => {},
      stopAll: async () => {
        process.stderr.write("startup-stop\n");
        return [];
      },
    };
  }
  if (request === "./lib/store" || request === "./lib/bridge") return {};
  return load.call(this, request, parent, isMain);
};

delete process.env.STANDALONE;
require(path.join(__dirname, "..", "..", "robot", "main.js"));
setTimeout(() => process.exit(0), 300);
