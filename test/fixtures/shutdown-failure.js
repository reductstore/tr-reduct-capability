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
      loadConfig: () => ({ autoStart: false, store: {}, bridge: {} }),
      saveConfig: (current) => current,
    };
  }
  if (request === "./lib/component-actions") {
    return {
      effectiveAction: (action) => action,
      requiresBilling: () => false,
      runComponentAction: async () => {},
      stopAll: async (_, options) => {
        const error = new Error("native stop failed");
        options.onError?.(error);
        return [error];
      },
    };
  }
  if (request === "./lib/store" || request === "./lib/bridge") return {};
  return load.call(this, request, parent, isMain);
};

process.env.STANDALONE = "true";
require(path.join(__dirname, "..", "..", "robot", "main.js"));
process.emit("SIGTERM");
