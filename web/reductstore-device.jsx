import React, { useEffect, useState } from "react";
import { createWebComponent, useTransitive } from "@transitive-sdk/utils-web";

const [scope, capabilityName] = TR_PKG_NAME.split("/");

const row = { display: "flex", alignItems: "center", gap: "8px", margin: "4px 0" };
const labelStyle = { minWidth: "150px", fontSize: "13px" };
const input = { flex: 1, padding: "4px 6px", fontSize: "13px" };
const section = { margin: "12px 0", padding: "8px", border: "1px solid #ddd", borderRadius: "4px" };
const btn = { padding: "6px 14px", margin: "4px 4px 4px 0", cursor: "pointer" };
const primaryBtn = { ...btn, background: "#0078d4", color: "#fff", border: "none", borderRadius: "3px" };
const disabledBtn = { ...primaryBtn, background: "#9bbfe0", cursor: "default" };
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

const Device = ({ jwt, id, host, ssl }) => {
  const { mqttSync, data, StatusComponent, prefixVersion, prefixPathVersion } = useTransitive({
    jwt, id, host, ssl,
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
    [...prefixPathVersion, "device"].reduce((o, k) => (o == null ? o : o[k]), data) || {};
  const remoteJson = dev.config?.json;

  // Load config once it arrives from the robot. The form stays gated until then
  // so a stale default is never saved over the device config.
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
    mqttSync.data.update(`${prefixVersion}/commands/request`, JSON.stringify({
      action, requestId: String(Date.now()), ts: Date.now(),
    }));
  };

  const control = (action) => {
    sendCommand(action);
    flash(`Sent ${action} command`);
  };

  // Save the edited config to the robot and restart so it takes effect.
  const apply = () => {
    if (!mqttSync || !cfg) return;
    mqttSync.data.update(`${prefixVersion}/config/json`, JSON.stringify(cfg));
    setTimeout(() => sendCommand("restart"), 400);
    flash("Applying configuration and restarting");
  };

  const discard = () => {
    if (!remoteJson) return;
    try {
      setCfg(JSON.parse(remoteJson));
      flash("Discarded local changes");
    } catch {
      // ignore malformed
    }
  };

  const setStore = (k, v) => setCfg({ ...cfg, store: { ...cfg.store, [k]: v } });
  const setBucket = (k, v) =>
    setCfg({ ...cfg, store: { ...cfg.store, bucket: { ...cfg.store.bucket, [k]: v } } });
  const setBridge = (k, v) => setCfg({ ...cfg, bridge: { ...cfg.bridge, [k]: v } });

  const state = dev.state || "unknown";
  const storeText = dev.store?.running ? (dev.store?.alive ? "running" : "starting") : "stopped";
  const bridgeText = dev.bridge?.enabled ? (dev.bridge?.running ? "running" : "stopped") : "disabled";
  const dirty = cfg != null && remoteJson != null && JSON.stringify(cfg) !== remoteJson;

  return (
    <div>
      <StatusComponent />
      <h4>{capabilityName}</h4>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "6px 0" }}>
        <span style={badge(state)}>{state}</span>
        <span style={{ fontSize: "13px", color: "#444" }}>
          store: <b>{storeText}</b>{" · "}bridge: <b>{bridgeText}</b>
        </span>
      </div>
      {dev.message && (
        <pre style={{
          whiteSpace: "pre-wrap",
          fontSize: "12px",
          margin: "4px 0",
          padding: "6px 8px",
          borderRadius: "4px",
          background: state === "error" ? "#fde7e9" : "#f4f4f4",
          color: state === "error" ? "#a4262c" : "#555",
          border: state === "error" ? "1px solid #f1707b" : "1px solid #eee",
        }}>
          {state === "error" ? "" : "last action: "}{dev.message}
        </pre>
      )}

      <div style={{ margin: "8px 0" }}>
        <button style={btn} onClick={() => control("start")}>Start</button>
        <button style={btn} onClick={() => control("stop")}>Stop</button>
        <button style={btn} onClick={() => control("restart")}>Restart</button>
        {feedback && (
          <span style={{ marginLeft: "8px", color: "#0078d4", fontSize: "13px" }}>{feedback}</span>
        )}
      </div>

      {!cfg ? (
        <div style={{ color: "#888" }}>
          <p>Loading configuration…</p>
          {waited && (
            <p style={{ fontSize: "12px" }}>
              The device has not reported its configuration yet. Make sure the
              capability is running on the robot.
              <button style={btn} onClick={() => mqttSync && mqttSync.subscribe(`${prefixVersion}/device`)}>
                Retry
              </button>
            </p>
          )}
        </div>
      ) : (
        <>
          <div style={section}>
            <h5>ReductStore (provisioning)</h5>
            <Field label="Image">
              <input style={input} value={cfg.store.image}
                onChange={(e) => setStore("image", e.target.value)} />
            </Field>
            <Field label="HTTP port">
              <input style={input} type="number" value={cfg.store.httpPort}
                onChange={(e) => setStore("httpPort", Number(e.target.value))} />
            </Field>
            <Field label="Data path">
              <input style={input} value={cfg.store.dataPath}
                onChange={(e) => setStore("dataPath", e.target.value)} />
            </Field>
            <Field label="API token">
              <input style={input} value={cfg.store.apiToken}
                onChange={(e) => setStore("apiToken", e.target.value)} />
            </Field>
            <Field label="Bucket name">
              <input style={input} value={cfg.store.bucket.name}
                onChange={(e) => setBucket("name", e.target.value)} />
            </Field>
            <Field label="Quota type">
              <select value={cfg.store.bucket.quotaType}
                onChange={(e) => setBucket("quotaType", e.target.value)}>
                <option>NONE</option>
                <option>FIFO</option>
                <option>HARD</option>
              </select>
            </Field>
            {cfg.store.bucket.quotaType !== "NONE" && (
              <Field label="Quota size">
                <input style={input} placeholder="e.g. 10GB" value={cfg.store.bucket.quotaSize}
                  onChange={(e) => setBucket("quotaSize", e.target.value)} />
              </Field>
            )}
          </div>

          <div style={section}>
            <h5>ReductBridge (TOML)</h5>
            <Field label="Enabled">
              <input type="checkbox" checked={!!cfg.bridge.enabled}
                onChange={(e) => setBridge("enabled", e.target.checked)} />
            </Field>
            <Field label="Image">
              <input style={input} value={cfg.bridge.image}
                onChange={(e) => setBridge("image", e.target.value)} />
            </Field>
            <Field label="ROS_DOMAIN_ID">
              <input style={input} type="number" value={cfg.bridge.rosDomainId}
                onChange={(e) => setBridge("rosDomainId", Number(e.target.value))} />
            </Field>
            <Field label="Extra mounts (host dirs)">
              <input style={input} placeholder="/path1, /path2"
                value={(cfg.bridge.mounts || []).join(", ")}
                onChange={(e) => setBridge("mounts",
                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
            </Field>
            <p style={hint}>
              Optional. Host directories mounted read only into the bridge
              container, for example a ROS 2 workspace with custom message
              definitions that schema_paths in the TOML points to. Leave empty
              for standard ROS 2 messages.
            </p>
            <div style={{ margin: "6px 0" }}>
              <label style={{ fontSize: "13px" }}>config.toml</label>
              <textarea
                style={{ width: "100%", minHeight: "220px", fontFamily: "monospace", fontSize: "12px" }}
                value={cfg.bridge.toml}
                onChange={(e) => setBridge("toml", e.target.value)}
              />
            </div>
          </div>

          <div>
            <button style={dirty ? primaryBtn : disabledBtn} onClick={apply} disabled={!dirty}>
              Apply &amp; Restart
            </button>
            <button style={btn} onClick={discard} disabled={!dirty}>Discard changes</button>
            <span style={{ marginLeft: "8px", fontSize: "12px", color: dirty ? "#b06000" : "#999" }}>
              {dirty ? "unsaved changes" : "in sync with device"}
            </span>
          </div>
          <p style={hint}>
            Apply saves the configuration to the robot and restarts the containers so it takes effect.
          </p>
        </>
      )}
    </div>
  );
};

createWebComponent(Device, `${capabilityName}-device`, TR_PKG_VERSION);
