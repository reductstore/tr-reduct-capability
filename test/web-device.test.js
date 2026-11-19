const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const esbuild = require("esbuild");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function loadDevice(data) {
  const result = esbuild.buildSync({
    entryPoints: [path.join(__dirname, "..", "web", "reductstore-device.jsx")],
    bundle: true,
    format: "cjs",
    platform: "node",
    external: ["react", "@transitive-sdk/utils-web"],
    write: false,
  });
  let Device;
  const module = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    "TR_PKG_NAME",
    "TR_PKG_VERSION_NS",
    "TR_PKG_VERSION",
    result.outputFiles[0].text,
  )(
    (request) => {
      if (request === "react") return React;
      if (request === "@transitive-sdk/utils-web") {
        return {
          createWebComponent(Component) {
            Device = Component;
          },
          useTransitive() {
            return {
              mqttSync: null,
              data,
              prefixVersion: "0.2",
              prefixPathVersion: [],
            };
          },
        };
      }
      return require(request);
    },
    module,
    module.exports,
    "@reductstore-tr/reductstore",
    "0.2",
    "0.2.17",
  );
  return Device;
}

test("identifies each component in the top-level state", () => {
  const Device = loadDevice({
    device: {
      state: "error",
      billing: { state: "valid" },
      store: { running: true, alive: false },
      bridge: { enabled: true, running: false },
    },
  });
  const markup = renderToStaticMarkup(React.createElement(Device, {}));

  assert.match(
    markup,
    /State<\/span><b[^>]*>ReductStore starting · ReductBridge stopped<\/b>/,
  );
  assert.doesNotMatch(markup, /<span[^>]*>Store<\/span>/);
  assert.doesNotMatch(markup, /<span[^>]*>Bridge<\/span>/);
});
