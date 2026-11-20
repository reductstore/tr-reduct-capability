const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const esbuild = require("esbuild");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function loadSections() {
  const result = esbuild.buildSync({
    entryPoints: [path.join(__dirname, "..", "web", "lib", "sections.jsx")],
    bundle: true,
    format: "cjs",
    platform: "node",
    external: ["react", "react-dom"],
    write: false,
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(
    (request) =>
      request === "react"
        ? { ...React, useLayoutEffect() {} }
        : require(request),
    module,
    module.exports,
  );
  return module.exports;
}

const config = {
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

test("uses Transitive's Bootstrap controls instead of ad-hoc styling", () => {
  const { StoreSection } = loadSections();
  const markup = renderToStaticMarkup(
    React.createElement(StoreSection, {
      cfg: config,
      setCfg() {},
      dirty: false,
      dev: { store: { running: true, alive: true }, bridge: {} },
      remote: config,
    }),
  );
  assert.match(markup, /class="mb-3 card"/);
  assert.match(markup, /class="[^"]*card-header"/);
  assert.match(markup, /<input[^>]*class="form-control"/);
  assert.match(markup, /<select[^>]*class="form-select"/);
  assert.doesNotMatch(markup, /style="[^"]*font-size:13px/);
});

test("badges each component state the way other capabilities do", () => {
  const { StoreSection, BridgeSection } = loadSections();
  const storeMarkup = renderToStaticMarkup(
    React.createElement(StoreSection, {
      cfg: config,
      setCfg() {},
      dirty: false,
      dev: { store: { running: true, alive: false }, bridge: {} },
      remote: config,
    }),
  );
  const bridgeMarkup = renderToStaticMarkup(
    React.createElement(BridgeSection, {
      cfg: config,
      setCfg() {},
      dirty: false,
      dev: { store: {}, bridge: { running: true } },
    }),
  );
  const disabledMarkup = renderToStaticMarkup(
    React.createElement(BridgeSection, {
      cfg: { ...config, bridge: { ...config.bridge, enabled: false } },
      setCfg() {},
      dirty: false,
      dev: { store: {}, bridge: {} },
    }),
  );

  assert.match(storeMarkup, /badge[^"]*bg-warning">Starting</);
  assert.match(bridgeMarkup, /badge[^"]*bg-success">Running</);
  assert.match(disabledMarkup, /badge[^"]*bg-secondary">Disabled</);
});

test("marks a card with unsaved changes", () => {
  const { StoreSection } = loadSections();
  const markup = renderToStaticMarkup(
    React.createElement(StoreSection, {
      cfg: config,
      setCfg() {},
      dirty: true,
      dev: { store: {}, bridge: {} },
      remote: config,
    }),
  );

  assert.match(markup, /class="mb-3 card border-warning"/);
});

test("hides Bridge configuration while the Bridge is switched off", () => {
  const { BridgeSection } = loadSections();
  const markup = renderToStaticMarkup(
    React.createElement(BridgeSection, {
      cfg: { ...config, bridge: { ...config.bridge, enabled: false } },
      setCfg() {},
      dirty: false,
      dev: { store: {}, bridge: {} },
    }),
  );

  assert.match(markup, /form-check-input/);
  assert.doesNotMatch(markup, /config\.toml/);
});

test("the apply button only looks actionable when it is", () => {
  const { ControlBar } = loadSections();
  const render = (props) =>
    renderToStaticMarkup(
      React.createElement(ControlBar, {
        dirty: false,
        issues: [],
        billingValid: true,
        canStart: false,
        canStop: true,
        onControl() {},
        onApply() {},
        onDiscard() {},
        ...props,
      }),
    );

  assert.match(render({ dirty: true }), /btn-primary"[^>]*>Apply/);
  assert.match(
    render({}),
    /disabled=""[^>]*btn-outline-secondary">Apply/,
    "idle apply must not look actionable",
  );
  assert.match(
    render({ dirty: true, issues: ["Replication #1: name is required"] }),
    /disabled=""[^>]*btn-outline-secondary">Apply/,
    "blocked apply must not look actionable",
  );
  assert.match(
    render({ dirty: true, billingValid: false }),
    /disabled=""[^>]*btn-outline-secondary">Apply/,
    "unbilled apply must not look actionable",
  );
});
