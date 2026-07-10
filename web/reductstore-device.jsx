import React, { useEffect, useState } from "react";
import { createWebComponent, useTransitive } from "@transitive-sdk/utils-web";

const [scope, capabilityName] = TR_PKG_NAME.split("/");

const BRIDGE_IMAGES = [
  { value: "reduct/bridge:main-ros2-jazzy", label: "ROS 2 (Jazzy)" },
  { value: "reduct/bridge:main-ros2-humble", label: "ROS 2 (Humble)" },
  { value: "reduct/bridge:main-ros1", label: "ROS 1" },
  { value: "reduct/bridge:main-iot", label: "IoT: MQTT / HTTP / Shell" },
];

const remoteHeader = (
  store,
) => `# ReductBridge config: https://www.reduct.store/docs/reduct-bridge
# Destination: the ReductStore running on this robot.
[remotes.reduct.local]
url = "http://127.0.0.1:${store?.httpPort ?? 8383}"
token_api = "${store?.apiToken ?? "transitive-local-token"}"
bucket = "${store?.bucket?.name ?? "robot-data"}"
prefix = "bridge/"
`;

const ros2Distro = (image) => {
  const m = /ros2-([a-z]+)/i.exec(image || "");
  return m ? m[1].toLowerCase() : "jazzy";
};

const BRIDGE_TEMPLATES = [
  {
    label: "ROS 2",
    build: (store, image) => `${remoteHeader(store)}
# A ROS 2 input. Add more [inputs.ros2.<name>] sections for more sources.
[inputs.ros2.ros2_local]
node_name = "reduct_bridge"
queue_size = 128
domain_id = 0
schema_paths = ["/opt/ros/${ros2Distro(image)}"]

[[inputs.ros2.ros2_local.topics]]
name = "/rosout"

[pipelines.ingest]
remote = "local"
inputs = ["ros2_local"]
`,
  },
  {
    label: "ROS 1",
    build: (store) => `${remoteHeader(store)}
# A ROS 1 input. Needs a running roscore.
[inputs.ros.ros_local]
uri = "http://localhost:11311"
node_name = "reduct_bridge"
queue_size = 128

[[inputs.ros.ros_local.topics]]
name = "/rosout"

[pipelines.ingest]
remote = "local"
inputs = ["ros_local"]
`,
  },
  {
    label: "MQTT",
    build: (store) => `${remoteHeader(store)}
# An MQTT input. Set a password via the bridge Extra env vars if needed.
[inputs.mqtt.main]
broker = "mqtt://localhost:1883"
client_id = "reduct-bridge"
version = "v5"
qos = 1

[[inputs.mqtt.main.topics]]
name = "sensors/+/telemetry"
entry_name = "telemetry"
content_type = "application/json"

[pipelines.ingest]
remote = "local"
inputs = ["main"]
`,
  },
  {
    label: "HTTP",
    build: (store) => `${remoteHeader(store)}
# An HTTP polling input.
[inputs.http.metrics_api]
url = "http://localhost:9000/metrics"
repeat_interval = 10
entry_name = "metrics"
content_type = "application/json"

[pipelines.ingest]
remote = "local"
inputs = ["metrics_api"]
`,
  },
  {
    label: "Shell",
    build: (store) => `${remoteHeader(store)}
# A shell input: runs a command on an interval and stores its output.
[inputs.shell.uptime]
repeat_interval = 10
command = "uptime"
entry_name = "uptime"
content_type = "text/plain"

[pipelines.ingest]
remote = "local"
inputs = ["uptime"]
`,
  },
];

const templateForImage = (image) => {
  if (/ros2/i.test(image))
    return BRIDGE_TEMPLATES.find((t) => t.label === "ROS 2");
  if (/ros1/i.test(image))
    return BRIDGE_TEMPLATES.find((t) => t.label === "ROS 1");
  if (/iot|mqtt/i.test(image))
    return BRIDGE_TEMPLATES.find((t) => t.label === "MQTT");
  return null;
};
const stripDynamic = (t) =>
  (t || "")
    .replace(/^url = "http:\/\/127\.0\.0\.1:\d+"$/gm, 'url = ""')
    .replace(/^token_api = ".*"$/gm, 'token_api = ""')
    .replace(/^bucket = ".*"$/gm, 'bucket = ""')
    .trim();
const matchingTemplate = (toml, store, image) =>
  BRIDGE_TEMPLATES.find(
    (t) => stripDynamic(t.build(store, image)) === stripDynamic(toml),
  );
const isTemplateToml = (toml, store, image) =>
  !toml?.trim() || !!matchingTemplate(toml, store, image);

const REP_REQUIRED = {
  name: "name",
  srcBucket: "source bucket",
  dstBucket: "dest bucket",
  dstHost: "dest host",
};
const isSet = (v) => v != null && String(v).trim() !== "";

const validateConfig = (c) => {
  const issues = [];
  const s = c.store || {};
  if (!isSet(s.image)) issues.push("Store: image is required");
  if (!isSet(s.httpPort)) issues.push("Store: HTTP port is required");
  if (!isSet(s.dataPath)) issues.push("Store: data path is required");
  if (!isSet(s.apiToken)) issues.push("Store: API token is required");
  if (!isSet(s.bucket?.name)) issues.push("Store: bucket name is required");
  if (c.bridge?.enabled && !isSet(c.bridge.image))
    issues.push("Bridge: image is required when enabled");
  const reps = s.replications || [];
  reps.forEach((r, i) => {
    const who = isSet(r.name) ? `"${r.name}"` : `#${i + 1}`;
    for (const [k, label] of Object.entries(REP_REQUIRED))
      if (!isSet(r[k])) issues.push(`Replication ${who}: ${label} is required`);
    if (isSet(r.name) && reps.some((o, j) => j !== i && o.name === r.name))
      issues.push(`Replication ${who}: name must be unique`);
  });
  return issues;
};

const row = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  margin: "4px 0",
};
const labelStyle = { minWidth: "150px", fontSize: "13px" };
const input = { flex: 1, padding: "4px 6px", fontSize: "13px" };
const section = {
  margin: "16px 0",
  padding: "12px",
  border: "1px solid #d5dbe2",
  borderRadius: "6px",
  background: "#fcfcfd",
};
// Amber-highlighted box when the section has unsaved edits.
const sectionStyle = (dirty) =>
  dirty
    ? { ...section, borderColor: "#e0a458", background: "#fffdf5" }
    : section;
const btn = { padding: "6px 14px", margin: "4px 4px 4px 0", cursor: "pointer" };
const barBtn = (on) => ({
  padding: "6px 14px",
  borderRadius: "3px",
  border: "1px solid #ccc",
  background: "#f3f3f3",
  color: "#222",
  cursor: on ? "pointer" : "not-allowed",
  opacity: on ? 1 : 0.45,
});
const barPrimary = (on) => ({
  ...barBtn(on),
  background: "#0078d4",
  color: "#fff",
  border: "1px solid #0078d4",
});
const divider = {
  width: "1px",
  alignSelf: "stretch",
  background: "#ddd",
  margin: "0 4px",
};
const hint = { fontSize: "12px", color: "#666", margin: "4px 0" };

const badgeColor = { running: "#107c10", error: "#d13438", stopped: "#666" };
const badge = (state) => ({
  background: badgeColor[state] || "#999",
  color: "#fff",
  padding: "2px 10px",
  borderRadius: "10px",
  fontSize: "12px",
  textTransform: "uppercase",
});

function Field({ label, children }) {
  return (
    <div style={row}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const dNode = {
  padding: "5px 9px",
  background: "#fff",
  border: "1px solid #cfd8e3",
  borderRadius: "4px",
  fontSize: "11px",
  textAlign: "center",
  lineHeight: 1.2,
};
// External to this capability (not configured here): drawn with a dashed border.
const dExternal = { ...dNode, borderStyle: "dashed", background: "#fafbfc" };
const dArrow = { color: "#8a97a8", fontSize: "15px" };

function Pipeline({ consoleUrl }) {
  const sub = { color: "#66707d" };
  return (
    <div style={{ margin: "8px 0 14px" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "8px",
          padding: "12px",
          background: "#f7f9fb",
          border: "1px solid #e3e8ee",
          borderRadius: "6px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ ...dNode, textAlign: "left" }}>
            <b>ReductBridge</b>
            <br />
            <span style={sub}>ROS 2 · ROS 1 · MQTT · HTTP · Shell</span>
          </div>
          <div style={{ ...dExternal, textAlign: "left" }}>
            <b>Zenoh or your app</b>
            <br />
            <span style={sub}>native API, no bridge</span>
          </div>
        </div>
        <span style={dArrow}>→</span>
        <div style={{ ...dNode, textAlign: "left" }}>
          ReductStore
          <br />
          this robot
          <br />
          {consoleUrl ? (
            <a
              href={consoleUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontWeight: 400, color: "#0078d4" }}
            >
              open web console ↗
            </a>
          ) : (
            <span style={{ fontWeight: 400, ...sub }}>web console</span>
          )}
        </div>
        <span style={dArrow}>→</span>
        <div style={dNode}>
          Replication
          <br />
          <span style={sub}>append only</span>
        </div>
        <span style={dArrow}>→</span>
        <div style={dExternal}>
          any other
          <br />
          ReductStore
          <br />
          <a
            href="https://www.reduct.store"
            target="_blank"
            rel="noreferrer"
            style={{ ...sub, color: "#0078d4" }}
          >
            self-hosted or cloud ↗
          </a>
        </div>
      </div>
      <p style={{ ...hint, margin: "4px 2px 0" }}>
        Solid boxes are configured here; dashed boxes are external.
      </p>
      <p style={{ ...hint, margin: "2px 2px 0" }}>
        Each bridge image records one input family; pick the image for your
        source. Zenoh and other apps can write straight into ReductStore through
        its API, without the bridge.
      </p>
    </div>
  );
}

function SectionHead({ title, href, dirty, onDiscard, children }) {
  return (
    <div
      style={{
        borderBottom: "1px solid #eee",
        paddingBottom: "6px",
        marginBottom: "8px",
      }}
    >
      <h5 style={{ margin: "0 0 2px", fontSize: "14px" }}>
        {title}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            style={{
              marginLeft: "8px",
              fontSize: "12px",
              fontWeight: 400,
              color: "#0078d4",
            }}
          >
            docs ↗
          </a>
        )}
        {dirty && (
          <span
            style={{
              marginLeft: "8px",
              fontSize: "12px",
              fontWeight: 400,
              color: "#b06000",
            }}
          >
            • unsaved, use Apply &amp; Restart above
            {onDiscard && (
              <button
                onClick={onDiscard}
                style={{
                  marginLeft: "6px",
                  padding: 0,
                  background: "none",
                  border: "none",
                  color: "#0078d4",
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontSize: "12px",
                }}
              >
                discard
              </button>
            )}
          </span>
        )}
      </h5>
      <p style={{ ...hint, margin: 0 }}>{children}</p>
    </div>
  );
}

const Device = ({ jwt, id, host, ssl }) => {
  const { mqttSync, data, StatusComponent, prefixVersion, prefixPathVersion } =
    useTransitive({
      jwt,
      id,
      host,
      ssl,
      capability: TR_PKG_NAME,
      versionNS: TR_PKG_VERSION_NS,
    });

  const [cfg, setCfg] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    if (!mqttSync) return;
    mqttSync.subscribe(`${prefixVersion}/device`);
    mqttSync.publish(`${prefixVersion}/commands`);
    mqttSync.publish(`${prefixVersion}/config`);
  }, [mqttSync, prefixVersion]);

  // useTransitive returns the full data tree from the root, so navigate to this
  // capability prefix to reach the device data the robot publishes.
  const dev =
    [...prefixPathVersion, "device"].reduce(
      (o, k) => (o == null ? o : o[k]),
      data,
    ) || {};
  const remoteJson = dev.config?.json;

  // Load config once it arrives; the form stays gated until then.
  useEffect(() => {
    if (remoteJson && !cfg) {
      try {
        setCfg(JSON.parse(remoteJson));
      } catch {
        // ignore malformed
      }
    }
  }, [remoteJson]);

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 8000);
    return () => clearTimeout(t);
  }, []);

  const flash = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const sendCommand = (action) => {
    if (!mqttSync) return;
    mqttSync.data.update(
      `${prefixVersion}/commands/request`,
      JSON.stringify({
        action,
        requestId: String(Date.now()),
        ts: Date.now(),
      }),
    );
  };

  const control = (action) => {
    sendCommand(action);
    flash(`Sending ${action}…`);
  };

  const apply = () => {
    if (!mqttSync || !cfg) return;
    mqttSync.data.update(`${prefixVersion}/config/json`, JSON.stringify(cfg));
    setTimeout(() => sendCommand("restart"), 400);
    flash("Applying and restarting…");
  };

  const discard = () => {
    if (!remoteJson) return;
    try {
      setCfg(JSON.parse(remoteJson));
    } catch {
      // ignore malformed
    }
  };

  const setStore = (k, v) =>
    setCfg({ ...cfg, store: { ...cfg.store, [k]: v } });
  const setBucket = (k, v) =>
    setCfg({
      ...cfg,
      store: { ...cfg.store, bucket: { ...cfg.store.bucket, [k]: v } },
    });
  const setBridge = (k, v) =>
    setCfg({ ...cfg, bridge: { ...cfg.bridge, [k]: v } });

  const reps = cfg?.store.replications || [];
  const setRep = (i, k, v) =>
    setStore(
      "replications",
      reps.map((r, j) => (j === i ? { ...r, [k]: v } : r)),
    );
  const addRep = () =>
    setStore("replications", [
      ...reps,
      {
        name: "",
        srcBucket: cfg.store.bucket.name,
        dstBucket: "",
        dstHost: "",
        dstToken: "",
        entries: "",
        when: "",
        mode: "enabled",
      },
    ]);
  const removeRep = (i) =>
    setStore(
      "replications",
      reps.filter((_, j) => j !== i),
    );
  const repStatus = (name) =>
    (dev.store?.replications || []).find((t) => t.name === name);

  const issues = cfg ? validateConfig(cfg) : [];

  const envVars = cfg?.store.env || [];
  const setEnv = (i, k, v) =>
    setStore(
      "env",
      envVars.map((e, j) => (j === i ? { ...e, [k]: v } : e)),
    );
  const addEnv = () => setStore("env", [...envVars, { key: "", value: "" }]);
  const removeEnv = (i) =>
    setStore(
      "env",
      envVars.filter((_, j) => j !== i),
    );

  const bridgeEnv = cfg?.bridge.env || [];
  const setBridgeEnv = (i, k, v) =>
    setBridge(
      "env",
      bridgeEnv.map((e, j) => (j === i ? { ...e, [k]: v } : e)),
    );
  const addBridgeEnv = () =>
    setBridge("env", [...bridgeEnv, { key: "", value: "" }]);
  const removeBridgeEnv = (i) =>
    setBridge(
      "env",
      bridgeEnv.filter((_, j) => j !== i),
    );
  const bridgeMounts = cfg?.bridge.mounts || [];
  const setMount = (i, v) =>
    setBridge(
      "mounts",
      bridgeMounts.map((m, j) => (j === i ? v : m)),
    );
  const addMount = () => setBridge("mounts", [...bridgeMounts, ""]);
  const removeMount = (i) =>
    setBridge(
      "mounts",
      bridgeMounts.filter((_, j) => j !== i),
    );
  const bridgeImageKnown =
    cfg && BRIDGE_IMAGES.some((im) => im.value === cfg.bridge.image);
  const bridgeIsRos2 = cfg && /ros2/i.test(cfg.bridge.image || "");

  // Swap the template too when the TOML is still an unedited template.
  const changeImage = (image) => {
    const tmpl = templateForImage(image);
    const bridge = { ...cfg.bridge, image };
    if (tmpl && isTemplateToml(cfg.bridge.toml, cfg.store, cfg.bridge.image))
      bridge.toml = tmpl.build(cfg.store, image);
    setCfg({ ...cfg, bridge });
  };
  const loadTemplate = (label) => {
    const tmpl = BRIDGE_TEMPLATES.find((t) => t.label === label);
    if (tmpl) setBridge("toml", tmpl.build(cfg.store, cfg.bridge.image));
  };

  const state = dev.state || "unknown";
  const storeText = dev.store?.running
    ? dev.store?.alive
      ? "running"
      : "starting"
    : "stopped";
  const bridgeText = dev.bridge?.enabled
    ? dev.bridge?.running
      ? "running"
      : "stopped"
    : "disabled";
  const dirty =
    cfg != null && remoteJson != null && JSON.stringify(cfg) !== remoteJson;

  let remote = null;
  try {
    remote = remoteJson ? JSON.parse(remoteJson) : null;
  } catch {
    remote = null;
  }
  const differs = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
  const withoutReps = (s) => {
    const { replications, ...rest } = s || {};
    return rest;
  };
  const storeDirty =
    !!cfg &&
    !!remote &&
    differs(withoutReps(cfg.store), withoutReps(remote.store));
  const repsDirty =
    !!cfg &&
    !!remote &&
    differs(cfg.store.replications, remote.store?.replications);
  const bridgeDirty = !!cfg && !!remote && differs(cfg.bridge, remote.bridge);
  const orphanReps = (dev.store?.replications || [])
    .map((t) => t.name)
    .filter(
      (n) =>
        n && !(remote?.store?.replications || []).some((r) => r.name === n),
    );

  const clone = (x) => JSON.parse(JSON.stringify(x));
  const discardStore = () =>
    remote &&
    setCfg({
      ...cfg,
      store: { ...clone(remote.store), replications: cfg.store.replications },
    });
  const discardReps = () =>
    remote &&
    setCfg({
      ...cfg,
      store: {
        ...cfg.store,
        replications: clone(remote.store?.replications || []),
      },
    });
  const discardBridge = () =>
    remote && setCfg({ ...cfg, bridge: clone(remote.bridge) });

  const canStart = state !== "running";
  const canStop = state !== "stopped";
  const storePort = dev.store?.httpPort || cfg?.store.httpPort;
  const consoleUrl =
    dev.store?.host && storePort
      ? `http://${dev.store.host}:${storePort}/`
      : null;

  return (
    <div>
      <StatusComponent />
      <h4>{capabilityName}</h4>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          margin: "6px 0",
        }}
      >
        <span style={badge(state)}>{state}</span>
        <span style={{ fontSize: "13px", color: "#444" }}>
          store: <b>{storeText}</b>
          {" · "}bridge: <b>{bridgeText}</b>
        </span>
      </div>
      {/* Your action (blue), settling into the robot's result (grey) or error (red). */}
      {(feedback || dev.message) && (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontSize: "12px",
            margin: "6px 0",
            padding: "6px 8px",
            borderRadius: "4px",
            ...(feedback
              ? {
                  background: "#eff6fc",
                  color: "#0078d4",
                  border: "1px solid #c7e0f4",
                }
              : state === "error"
                ? {
                    background: "#fde7e9",
                    color: "#a4262c",
                    border: "1px solid #f1707b",
                  }
                : {
                    background: "#f4f4f4",
                    color: "#555",
                    border: "1px solid #eee",
                  }),
          }}
        >
          {feedback || `Last command: ${dev.message}`}
        </pre>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "6px",
          margin: "10px 0 4px",
        }}
      >
        <button
          style={barBtn(canStart)}
          disabled={!canStart}
          onClick={() => control("start")}
        >
          Start
        </button>
        <button
          style={barBtn(canStop)}
          disabled={!canStop}
          onClick={() => control("stop")}
        >
          Stop
        </button>
        <button style={barBtn(true)} onClick={() => control("restart")}>
          Restart
        </button>
        <span style={divider} />
        <button
          style={barPrimary(dirty && issues.length === 0)}
          disabled={!dirty || issues.length > 0}
          onClick={apply}
        >
          Apply &amp; Restart
        </button>
        <button style={barBtn(dirty)} disabled={!dirty} onClick={discard}>
          Discard changes
        </button>
      </div>
      {issues.length > 0 && (
        <ul
          style={{
            ...hint,
            color: "#c00",
            margin: "2px 0 0",
            paddingLeft: "18px",
          }}
        >
          {issues.map((msg, i) => (
            <li key={i}>{msg}</li>
          ))}
        </ul>
      )}
      <p style={hint}>
        Start / Stop / Restart control the containers. Apply saves your config
        edits to the robot and restarts so they take effect.
      </p>

      {!cfg ? (
        <div style={{ color: "#888" }}>
          <p>Loading configuration…</p>
          {waited && (
            <p style={{ fontSize: "12px" }}>
              The device has not reported its configuration yet. Make sure the
              capability is running on the robot.
              <button
                style={btn}
                onClick={() =>
                  mqttSync && mqttSync.subscribe(`${prefixVersion}/device`)
                }
              >
                Retry
              </button>
            </p>
          )}
        </div>
      ) : (
        <>
          <Pipeline consoleUrl={consoleUrl} />

          <div style={sectionStyle(storeDirty)}>
            <SectionHead
              title="ReductStore, the database on this robot"
              href="https://www.reduct.store/docs/configuration/provisioning"
              dirty={storeDirty}
              onDiscard={discardStore}
            >
              Incoming records are stored here in buckets on the robot,
              configured through provisioning env vars.
            </SectionHead>
            <Field label="Image">
              <input
                style={input}
                value={cfg.store.image}
                onChange={(e) => setStore("image", e.target.value)}
              />
            </Field>
            <Field label="HTTP port">
              <input
                style={input}
                type="number"
                value={cfg.store.httpPort}
                onChange={(e) => setStore("httpPort", Number(e.target.value))}
              />
            </Field>
            <Field label="Data path">
              <input
                style={input}
                value={cfg.store.dataPath}
                onChange={(e) => setStore("dataPath", e.target.value)}
              />
            </Field>
            <Field label="API token">
              <input
                style={input}
                value={cfg.store.apiToken}
                onChange={(e) => setStore("apiToken", e.target.value)}
              />
            </Field>
            <Field label="Bucket name">
              <input
                style={input}
                value={cfg.store.bucket.name}
                onChange={(e) => setBucket("name", e.target.value)}
              />
            </Field>
            <Field label="Quota type">
              <select
                value={cfg.store.bucket.quotaType}
                onChange={(e) => setBucket("quotaType", e.target.value)}
              >
                <option>NONE</option>
                <option>FIFO</option>
                <option>HARD</option>
              </select>
            </Field>
            {cfg.store.bucket.quotaType !== "NONE" && (
              <Field label="Quota size">
                <input
                  style={input}
                  placeholder="e.g. 1GB"
                  value={cfg.store.bucket.quotaSize}
                  onChange={(e) => setBucket("quotaSize", e.target.value)}
                />
              </Field>
            )}

            <div
              style={{
                margin: "10px 0 4px",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Extra env vars
            </div>
            <p style={hint}>
              Any additional ReductStore settings, applied on top of the fields
              above. If one repeats a setting from above, the value here is
              used.
            </p>
            {envVars.map((e, i) => (
              <div key={i} style={row}>
                <input
                  style={{ ...input, maxWidth: "220px" }}
                  placeholder="RS_LOG_LEVEL"
                  value={e.key || ""}
                  onChange={(ev) => setEnv(i, "key", ev.target.value)}
                />
                <span>=</span>
                <input
                  style={input}
                  placeholder="value"
                  value={e.value || ""}
                  onChange={(ev) => setEnv(i, "value", ev.target.value)}
                />
                <button style={btn} onClick={() => removeEnv(i)}>
                  ×
                </button>
              </div>
            ))}
            <button style={btn} onClick={addEnv}>
              Add variable
            </button>
          </div>

          <div style={sectionStyle(repsDirty)}>
            <SectionHead
              title="Replication, send new data to a remote ReductStore"
              href="https://www.reduct.store/docs/guides/data-replication"
              dirty={repsDirty}
              onDiscard={discardReps}
            >
              As records are written to a local bucket, they are also sent to a
              remote or cloud ReductStore. It only adds new records, never
              changing or deleting existing data. Optionally send only the
              records that match a "when" filter. Tasks are provisioned on the
              store, so changes apply on Apply &amp; Restart.
            </SectionHead>
            {reps.map((r, i) => (
              <div
                key={i}
                style={{
                  border: "1px solid #eee",
                  borderRadius: "4px",
                  padding: "6px",
                  margin: "6px 0",
                }}
              >
                <Field label="Name">
                  <input
                    style={input}
                    value={r.name || ""}
                    onChange={(e) => setRep(i, "name", e.target.value)}
                  />
                </Field>
                <Field label="Source bucket">
                  <input
                    style={input}
                    value={r.srcBucket || ""}
                    onChange={(e) => setRep(i, "srcBucket", e.target.value)}
                  />
                </Field>
                <Field label="Dest bucket">
                  <input
                    style={input}
                    value={r.dstBucket || ""}
                    onChange={(e) => setRep(i, "dstBucket", e.target.value)}
                  />
                </Field>
                <Field label="Dest host">
                  <input
                    style={input}
                    placeholder="https://play.reduct.store"
                    value={r.dstHost || ""}
                    onChange={(e) => setRep(i, "dstHost", e.target.value)}
                  />
                </Field>
                <Field label="Dest token">
                  <input
                    style={input}
                    value={r.dstToken || ""}
                    onChange={(e) => setRep(i, "dstToken", e.target.value)}
                  />
                </Field>
                <Field label="Entries">
                  <input
                    style={input}
                    placeholder="entry1, entry2 (optional, all if empty)"
                    value={r.entries || ""}
                    onChange={(e) => setRep(i, "entries", e.target.value)}
                  />
                </Field>
                <Field label="Mode">
                  <select
                    style={input}
                    value={r.mode || "enabled"}
                    onChange={(e) => setRep(i, "mode", e.target.value)}
                  >
                    <option value="enabled">enabled</option>
                    <option value="paused">paused</option>
                    <option value="disabled">disabled</option>
                  </select>
                </Field>
                <div style={{ margin: "4px 0" }}>
                  <label style={{ fontSize: "13px" }}>
                    Filter, "when" (optional)
                  </label>
                  <textarea
                    style={{
                      width: "100%",
                      minHeight: "70px",
                      fontFamily: "monospace",
                      fontSize: "12px",
                    }}
                    placeholder='JSON condition, e.g. {"&temperature": {"$gt": 10}}'
                    value={r.when || ""}
                    onChange={(e) => setRep(i, "when", e.target.value)}
                  />
                  <p style={{ ...hint, margin: "2px 0 0" }}>
                    Only replicate records matching this condition. Leave empty
                    to replicate everything.
                  </p>
                </div>
                {repStatus(r.name) && (
                  <p style={hint}>
                    on device:{" "}
                    <b>
                      {repStatus(r.name).is_provisioned
                        ? "provisioned"
                        : "unprovisioned"}
                    </b>
                    {" · "}
                    {repStatus(r.name).is_active ? "active" : "inactive"}
                    {" · pending: "}
                    {repStatus(r.name).pending_records}
                  </p>
                )}
                <button style={btn} onClick={() => removeRep(i)}>
                  Remove task
                </button>
              </div>
            ))}
            {orphanReps.length > 0 && (
              <p style={{ ...hint, color: "#b26a00" }}>
                ⚠ {orphanReps.map((n) => `"${n}"`).join(", ")}{" "}
                {orphanReps.length > 1 ? "are" : "is"} on the device but not
                managed here (e.g. created manually).
                {consoleUrl && (
                  <>
                    {" "}
                    Delete {orphanReps.length > 1 ? "them" : "it"} in the{" "}
                    <a href={consoleUrl} target="_blank" rel="noreferrer">
                      ReductStore console
                    </a>{" "}
                    if unwanted.
                  </>
                )}
              </p>
            )}
            <button style={btn} onClick={addRep}>
              Add replication task
            </button>
          </div>

          <div style={sectionStyle(bridgeDirty)}>
            <SectionHead
              title="ReductBridge, record data into the store"
              href="https://www.reduct.store/docs/reduct-bridge"
              dirty={bridgeDirty}
              onDiscard={discardBridge}
            >
              Writes incoming data into the local ReductStore. The default image
              records ROS 2 topics; other images record ROS 1, MQTT, shell, or
              HTTP. Configured with the TOML below.
            </SectionHead>
            <Field label="Enabled">
              <input
                type="checkbox"
                checked={!!cfg.bridge.enabled}
                onChange={(e) => setBridge("enabled", e.target.checked)}
              />
            </Field>
            <Field label="Image family">
              <select
                style={input}
                value={bridgeImageKnown ? cfg.bridge.image : ""}
                onChange={(e) => changeImage(e.target.value)}
              >
                {!bridgeImageKnown && (
                  <option value="" disabled>
                    Custom (see tag below)
                  </option>
                )}
                {BRIDGE_IMAGES.map((im) => (
                  <option key={im.value} value={im.value}>
                    {im.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Image tag">
              <input
                style={input}
                placeholder="reduct/bridge:tag"
                value={cfg.bridge.image}
                onChange={(e) => setBridge("image", e.target.value)}
              />
            </Field>
            {bridgeIsRos2 && (
              <Field label="ROS_DOMAIN_ID">
                <input
                  style={input}
                  type="number"
                  value={cfg.bridge.rosDomainId}
                  onChange={(e) =>
                    setBridge("rosDomainId", Number(e.target.value))
                  }
                />
              </Field>
            )}
            <div
              style={{
                margin: "10px 0 4px",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Extra mounts (host dirs)
            </div>
            <p style={hint}>
              Optional volume mounts (not env vars). Host directories mounted
              read only into the container at the same path, for example a ROS 2
              workspace with custom message schemas the TOML references. Leave
              empty otherwise.
            </p>
            {bridgeMounts.map((m, i) => (
              <div key={i} style={row}>
                <input
                  style={input}
                  placeholder="/home/user/ros2_ws/install"
                  value={m || ""}
                  onChange={(ev) => setMount(i, ev.target.value)}
                />
                <button style={btn} onClick={() => removeMount(i)}>
                  ×
                </button>
              </div>
            ))}
            <button style={btn} onClick={addMount}>
              Add mount
            </button>

            <div
              style={{
                margin: "10px 0 4px",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Extra env vars
            </div>
            <p style={hint}>
              Optional. Extra environment variables for the bridge container.
            </p>
            {bridgeEnv.map((e, i) => (
              <div key={i} style={row}>
                <input
                  style={{ ...input, maxWidth: "220px" }}
                  placeholder="RUST_LOG"
                  value={e.key || ""}
                  onChange={(ev) => setBridgeEnv(i, "key", ev.target.value)}
                />
                <span>=</span>
                <input
                  style={input}
                  placeholder="value"
                  value={e.value || ""}
                  onChange={(ev) => setBridgeEnv(i, "value", ev.target.value)}
                />
                <button style={btn} onClick={() => removeBridgeEnv(i)}>
                  ×
                </button>
              </div>
            ))}
            <button style={btn} onClick={addBridgeEnv}>
              Add variable
            </button>

            <div style={{ margin: "6px 0" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "6px",
                }}
              >
                <label style={{ fontSize: "13px" }}>config.toml</label>
                <select
                  style={{ fontSize: "12px", padding: "2px 4px" }}
                  value=""
                  onChange={(e) => {
                    if (e.target.value) loadTemplate(e.target.value);
                  }}
                >
                  <option value="">Load template…</option>
                  {BRIDGE_TEMPLATES.map((t) => (
                    <option key={t.label} value={t.label}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                style={{
                  width: "100%",
                  minHeight: "420px",
                  fontFamily: "monospace",
                  fontSize: "12px",
                }}
                value={cfg.bridge.toml}
                onChange={(e) => setBridge("toml", e.target.value)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

createWebComponent(Device, `${capabilityName}-device`, TR_PKG_VERSION);
