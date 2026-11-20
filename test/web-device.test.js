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

test("raises a Bootstrap alert when billing is invalid", () => {
  const Device = loadDevice({
    device: {
      billing: { state: "invalid" },
      store: { running: true, alive: false },
      bridge: { enabled: true, running: false },
    },
  });
  const markup = renderToStaticMarkup(React.createElement(Device, {}));

  assert.match(markup, /alert alert-danger[^"]*">Billing is invalid/);
  assert.doesNotMatch(markup, /Overall state/);
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

function mountDevice(deviceState = {}) {
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
        ...deviceState,
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

const button = (root, label) =>
  root.root.findAll(
    (node) =>
      node.type === "button" && String(node.children[0] || "") === label,
  );

const commandsIn = (sent) =>
  sent
    .filter((m) => m.topic.endsWith("/commands/request"))
    .map((m) => JSON.parse(m.value));

test("the whole capability is driven by four controls", () => {
  const { root } = mountDevice();

  assert.equal(button(root, "Apply & restart").length, 1);
  assert.equal(button(root, "Discard").length, 1);
  assert.equal(button(root, "Start").length, 1);
  assert.equal(button(root, "Stop").length, 1);
  assert.equal(button(root, "Restart").length, 0);
  assert.equal(button(root, "Disable ReductBridge").length, 0);

  act(() => root.unmount());
});

test("one apply restarts Store and Bridge together", () => {
  const { root, sent } = mountDevice();

  const apply = button(root, "Apply & restart")[0];
  assert.equal(apply.props.disabled, true);

  const port = root.root.findAll(
    (node) => node.type === "input" && node.props.value === 8383,
  )[0];
  act(() => port.props.onChange({ target: { value: "9000" } }));
  const toml = root.root.findAll((node) => node.type === "textarea")[0];
  act(() => toml.props.onChange({ target: { value: "[[task]]\n" } }));

  assert.equal(button(root, "Apply & restart")[0].props.disabled, false);
  act(() => button(root, "Apply & restart")[0].props.onClick());

  const commands = commandsIn(sent);
  assert.equal(commands.length, 1, "a single command restarts both");
  assert.equal(commands[0].action, "restart");
  assert.equal(commands[0].config.store.httpPort, 9000);
  assert.equal(commands[0].config.bridge.toml, "[[task]]\n");

  act(() => root.unmount());
});

test("Start and Stop follow what is actually running", () => {
  const running = mountDevice();
  assert.equal(button(running.root, "Start")[0].props.disabled, true);
  assert.equal(button(running.root, "Stop")[0].props.disabled, false);
  act(() => button(running.root, "Stop")[0].props.onClick());
  assert.deepEqual(
    commandsIn(running.sent).map((c) => c.action),
    ["stop"],
  );
  act(() => running.root.unmount());

  const stopped = mountDevice({
    store: { running: false },
    bridge: { enabled: true, running: false },
  });
  assert.equal(button(stopped.root, "Start")[0].props.disabled, false);
  assert.equal(button(stopped.root, "Stop")[0].props.disabled, true);
  act(() => button(stopped.root, "Start")[0].props.onClick());
  assert.deepEqual(
    commandsIn(stopped.sent).map((c) => c.action),
    ["start"],
  );
  act(() => stopped.root.unmount());
});

test("a crashed Bridge keeps Start available while the Store runs", () => {
  const { root } = mountDevice({
    store: { running: true, alive: true },
    bridge: { enabled: true, running: false },
  });

  assert.equal(button(root, "Start")[0].props.disabled, false);
  assert.equal(button(root, "Stop")[0].props.disabled, false);

  act(() => root.unmount());
});

test("the Bridge switch is config, applied with everything else", () => {
  const { root, sent } = mountDevice();

  const toggle = root.root.findAll(
    (node) => node.type === "input" && node.props.type === "checkbox",
  )[0];
  assert.equal(toggle.props.checked, true);
  act(() => toggle.props.onChange({ target: { checked: false } }));

  assert.equal(commandsIn(sent).length, 0, "toggling alone sends no command");
  assert.equal(button(root, "Apply & restart")[0].props.disabled, false);

  act(() => button(root, "Apply & restart")[0].props.onClick());
  const commands = commandsIn(sent);
  assert.equal(commands.length, 1);
  assert.equal(commands[0].config.bridge.enabled, false);

  act(() => root.unmount());
});

test("discarding restores both Store and Bridge to the device config", () => {
  const { root, sent } = mountDevice();

  const port = root.root.findAll(
    (node) => node.type === "input" && node.props.value === 8383,
  )[0];
  act(() => port.props.onChange({ target: { value: "9000" } }));
  assert.equal(button(root, "Apply & restart")[0].props.disabled, false);

  act(() => button(root, "Discard")[0].props.onClick());

  assert.equal(button(root, "Apply & restart")[0].props.disabled, true);
  assert.equal(commandsIn(sent).length, 0);

  act(() => root.unmount());
});
