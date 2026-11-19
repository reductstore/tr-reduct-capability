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
    external: ["react"],
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
  bridge: {},
};

test("groups dirty Store actions with visible spacing", () => {
  const { StoreSection } = loadSections();
  const markup = renderToStaticMarkup(
    React.createElement(StoreSection, {
      cfg: config,
      setCfg() {},
      dirty: true,
      dev: { store: {}, bridge: {} },
      remote: config,
      billingValid: true,
      onControl() {},
      onApply() {},
      onDiscard() {},
    }),
  );

  assert.match(
    markup,
    /Unsaved changes<\/div><div style="display:flex;flex-wrap:wrap;gap:6px"><button[^>]*>Apply &amp; restart ReductStore<\/button><button[^>]*>Discard<\/button>/,
  );
});

test("does not repeat component state in cards", () => {
  const { StoreSection } = loadSections();
  const markup = renderToStaticMarkup(
    React.createElement(StoreSection, {
      cfg: config,
      setCfg() {},
      dirty: false,
      dev: { store: { running: true, alive: true }, bridge: {} },
      remote: config,
      billingValid: true,
      onControl() {},
      onApply() {},
      onDiscard() {},
    }),
  );

  assert.doesNotMatch(markup, /Status:/);
});
