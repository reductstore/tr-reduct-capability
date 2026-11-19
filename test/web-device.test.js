const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const esbuild = require("esbuild");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { act, create } = require("react-test-renderer");

function loadDevice(data, mqttSync = null) {
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
              mqttSync,
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

test("shows billing only when invalid and omits the top summary", () => {
  const Device = loadDevice({
    device: {
      state: "error",
      billing: { state: "invalid" },
      store: { running: true, alive: false },
      bridge: { enabled: true, running: false },
    },
  });
  const markup = renderToStaticMarkup(React.createElement(Device, {}));

  assert.match(markup, /Billing: invalid/);
  assert.doesNotMatch(markup, /Overall state/);
  assert.doesNotMatch(
    markup,
    /<span[^>]*>ReductStore<\/span><b[^>]*>starting<\/b>/,
  );
});

const remoteConfig = {
  autoStart: true,
  store: {
    httpPort: 8383,
    dataPath: "/data",
    apiToken: "token",
    bucket: { name: "robot-data", quotaType: "FIFO", quotaSize: "1GB" },
    env: [],
    replications: [],
  },
  bridge: {
    enabled: true,
    variant: "iot",
    preset: "mqtt",
    env: [],
    toml: "",
  },
};

function mountDevice() {
  const sent = [];
  const mqttSync = {
    subscribe() {},
    publish() {},
    data: {
      update(topic, value) {
        sent.push({ topic, value });
      },
    },
  };
  const Device = loadDevice(
    {
      device: {
        billing: { state: "valid" },
        store: { running: true, alive: true },
        bridge: { enabled: true, running: true },
        config: { json: JSON.stringify(remoteConfig) },
      },
    },
    mqttSync,
  );
  let root;
  act(() => {
    root = create(React.createElement(Device, {}));
  });
  return { root, sent };
}

const applyButtons = (root) =>
  root.root.findAll(
    (node) =>
      node.type === "button" &&
      String(node.children[0] || "").startsWith("Apply"),
  );

test("one apply bar below both cards restarts Store and Bridge together", () => {
  const { root, sent } = mountDevice();

  const buttons = applyButtons(root);
  assert.equal(buttons.length, 1, "exactly one apply control for both cards");
  assert.equal(buttons[0].props.disabled, true);
  assert.equal(buttons[0].props.style.background, "#f3f3f3");

  const port = root.root.findAll(
    (node) => node.type === "input" && node.props.value === 8383,
  )[0];
  act(() => port.props.onChange({ target: { value: "9000" } }));
  const toml = root.root.findAll((node) => node.type === "textarea")[0];
  act(() => toml.props.onChange({ target: { value: "[[task]]\n" } }));

  const apply = applyButtons(root)[0];
  assert.equal(apply.props.disabled, false);
  assert.equal(apply.props.style.background, "#0078d4");

  act(() => apply.props.onClick());

  const commands = sent.filter((m) => m.topic.endsWith("/commands/request"));
  assert.equal(commands.length, 1, "a single command restarts both");
  const command = JSON.parse(commands[0].value);
  assert.equal(command.action, "restart-store");
  assert.equal(command.config.store.httpPort, 9000);
  assert.equal(command.config.bridge.toml, "[[task]]\n");

  act(() => root.unmount());
});

test("discarding restores both Store and Bridge to the device config", () => {
  const { root, sent } = mountDevice();

  const port = root.root.findAll(
    (node) => node.type === "input" && node.props.value === 8383,
  )[0];
  act(() => port.props.onChange({ target: { value: "9000" } }));
  assert.equal(applyButtons(root)[0].props.disabled, false);

  const discard = root.root.findAll(
    (node) => node.type === "button" && node.children[0] === "Discard",
  )[0];
  act(() => discard.props.onClick());

  assert.equal(applyButtons(root)[0].props.disabled, true);
  assert.equal(
    sent.filter((m) => m.topic.endsWith("/commands/request")).length,
    0,
  );

  act(() => root.unmount());
});
