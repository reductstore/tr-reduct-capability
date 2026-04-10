import React, { useEffect, useState } from "react";
import { createWebComponent, useTransitive } from "@transitive-sdk/utils-web";

const [scope, capabilityName] = TR_PKG_NAME.split("/");

const tabStyle = (active) => ({
  padding: "6px 16px",
  cursor: "pointer",
  border: "none",
  borderBottom: active ? "2px solid #0078d4" : "2px solid transparent",
  background: "none",
  fontWeight: active ? 600 : 400,
  color: active ? "#0078d4" : "#333",
});

const sectionStyle = {
  margin: "12px 0",
  padding: "8px",
  border: "1px solid #ddd",
  borderRadius: "4px",
};
const fieldRow = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  margin: "4px 0",
};
const labelStyle = { minWidth: "160px", fontSize: "13px" };
const inputStyle = { flex: 1, padding: "4px 6px", fontSize: "13px" };
const btnStyle = {
  padding: "6px 14px",
  margin: "4px 4px 4px 0",
  cursor: "pointer",
};
const smallBtn = { padding: "2px 8px", cursor: "pointer", fontSize: "12px" };

function Field({ label, children }) {
  return (
    <div style={fieldRow}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function StatusTab({ data, send }) {
  const state = data?.device?.status?.state || "unknown";
  const alive = data?.device?.health?.alive ? "alive" : "down";
  const storeState = data?.device?.runtime?.store?.state || "unknown";
  const bridgeState = data?.device?.runtime?.bridge?.state || "unknown";
  const bridgeConfigured = data?.device?.runtime?.bridge?.configured
    ? "yes"
    : "no";
  const inputCount = data?.device?.runtime?.bridge?.inputCount || 0;
  const lastBootAt = data?.device?.status?.lastBootAt;

  return (
    <div>
      <p>
        state: <b>{state}</b> / health: <b>{alive}</b>
      </p>
      <p>
        store: <b>{storeState}</b> / bridge: <b>{bridgeState}</b>
      </p>
      <p>
        bridge configured: <b>{bridgeConfigured}</b> / topic subscriptions:{" "}
        <b>{inputCount}</b>
      </p>
      {lastBootAt && (
        <p style={{ fontSize: "12px", color: "#666" }}>
          last boot: {new Date(lastBootAt).toLocaleString()}
        </p>
      )}
      <div style={{ marginTop: "8px" }}>
        <button style={btnStyle} onClick={() => send("start")}>
          Start
        </button>
        <button style={btnStyle} onClick={() => send("stop")}>
          Stop
        </button>
        <button style={btnStyle} onClick={() => send("restart")}>
          Restart
        </button>
      </div>
    </div>
  );
}

function StoreTab({ config, onChange }) {
  const store = config?.store || {};
  const set = (key, val) =>
    onChange({ ...config, store: { ...store, [key]: val } });

  return (
    <div style={sectionStyle}>
      <h5>ReductStore Container</h5>
      <Field label="Image">
        <input
          style={inputStyle}
          value={store.image || ""}
          onChange={(e) => set("image", e.target.value)}
        />
      </Field>
      <Field label="Container name">
        <input
          style={inputStyle}
          value={store.containerName || ""}
          onChange={(e) => set("containerName", e.target.value)}
        />
      </Field>
      <Field label="HTTP port">
        <input
          style={inputStyle}
          type="number"
          value={store.httpPort || 8383}
          onChange={(e) => set("httpPort", Number(e.target.value))}
        />
      </Field>
      <Field label="Data path">
        <input
          style={inputStyle}
          value={store.dataPath || ""}
          onChange={(e) => set("dataPath", e.target.value)}
        />
      </Field>
      <Field label="Auth enabled">
        <input
          type="checkbox"
          checked={!!store.authEnabled}
          onChange={(e) => set("authEnabled", e.target.checked)}
        />
      </Field>
      {store.authEnabled && (
        <Field label="API token">
          <input
            style={inputStyle}
            value={store.apiToken || ""}
            onChange={(e) => set("apiToken", e.target.value)}
          />
        </Field>
      )}
    </div>
  );
}

function BridgeTab({ config, onChange }) {
  const bridge = config?.bridge || {};
  const [showAdvanced, setShowAdvanced] = useState(false);
  const set = (key, val) =>
    onChange({ ...config, bridge: { ...bridge, [key]: val } });

  return (
    <div style={sectionStyle}>
      <h5>ReductBridge</h5>
      <Field label="Enabled">
        <input
          type="checkbox"
          checked={!!bridge.enabled}
          onChange={(e) => set("enabled", e.target.checked)}
        />
      </Field>
      <Field label="Command">
        <input
          style={inputStyle}
          value={bridge.command || ""}
          onChange={(e) => set("command", e.target.value)}
        />
      </Field>
      <Field label="Remote name">
        <input
          style={inputStyle}
          value={bridge.remoteName || ""}
          onChange={(e) => set("remoteName", e.target.value)}
        />
      </Field>
      <Field label="Bucket">
        <input
          style={inputStyle}
          value={bridge.bucket || ""}
          onChange={(e) => set("bucket", e.target.value)}
        />
      </Field>
      <Field label="Prefix">
        <input
          style={inputStyle}
          value={bridge.prefix || ""}
          onChange={(e) => set("prefix", e.target.value)}
        />
      </Field>
      <Field label="Batch max records">
        <input
          style={inputStyle}
          type="number"
          value={bridge.batchMaxRecords || 80}
          onChange={(e) => set("batchMaxRecords", Number(e.target.value))}
        />
      </Field>
      <Field label="Batch max bytes">
        <input
          style={inputStyle}
          type="number"
          value={bridge.batchMaxSizeBytes || 8388608}
          onChange={(e) => set("batchMaxSizeBytes", Number(e.target.value))}
        />
      </Field>
      <Field label="Batch interval (ms)">
        <input
          style={inputStyle}
          type="number"
          value={bridge.batchMaxIntervalMs || 1000}
          onChange={(e) => set("batchMaxIntervalMs", Number(e.target.value))}
        />
      </Field>
      <div style={{ marginTop: "8px" }}>
        <button style={smallBtn} onClick={() => setShowAdvanced(!showAdvanced)}>
          {showAdvanced ? "Hide" : "Show"} advanced paths
        </button>
      </div>
      {showAdvanced && (
        <div style={{ marginTop: "6px" }}>
          <Field label="Config path">
            <input
              style={inputStyle}
              value={bridge.configPath || ""}
              onChange={(e) => set("configPath", e.target.value)}
            />
          </Field>
          <Field label="Log path">
            <input
              style={inputStyle}
              value={bridge.logPath || ""}
              onChange={(e) => set("logPath", e.target.value)}
            />
          </Field>
          <Field label="PID path">
            <input
              style={inputStyle}
              value={bridge.pidPath || ""}
              onChange={(e) => set("pidPath", e.target.value)}
            />
          </Field>
          <Field label="ROS home">
            <input
              style={inputStyle}
              value={bridge.rosHome || ""}
              onChange={(e) => set("rosHome", e.target.value)}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function TopicRow({ topic, onUpdate, onRemove }) {
  return (
    <div style={{ ...fieldRow, alignItems: "flex-start" }}>
      <input
        style={{ ...inputStyle, maxWidth: "200px" }}
        placeholder="topic name"
        value={topic.name || ""}
        onChange={(e) => onUpdate({ ...topic, name: e.target.value })}
      />
      <input
        style={{ ...inputStyle, maxWidth: "160px" }}
        placeholder="entry name (opt)"
        value={topic.entryName || ""}
        onChange={(e) =>
          onUpdate({ ...topic, entryName: e.target.value || undefined })
        }
      />
      <button style={smallBtn} onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}

function RosSection({ label, rosKey, config, onChange }) {
  const section = config?.[rosKey] || {};
  const set = (key, val) =>
    onChange({ ...config, [rosKey]: { ...section, [key]: val } });
  const topics = Array.isArray(section.topics) ? section.topics : [];
  const setTopic = (idx, topic) => {
    const next = [...topics];
    next[idx] = topic;
    set("topics", next);
  };
  const removeTopic = (idx) =>
    set(
      "topics",
      topics.filter((_, i) => i !== idx),
    );
  const addTopic = () => set("topics", [...topics, { name: "" }]);

  return (
    <div style={{ ...sectionStyle, marginTop: "8px" }}>
      <h5>{label}</h5>
      <Field label="Enabled">
        <input
          type="checkbox"
          checked={!!section.enabled}
          onChange={(e) => set("enabled", e.target.checked)}
        />
      </Field>
      <Field label="Input name">
        <input
          style={inputStyle}
          value={section.inputName || ""}
          onChange={(e) => set("inputName", e.target.value)}
        />
      </Field>
      <Field label="Node name">
        <input
          style={inputStyle}
          value={section.nodeName || ""}
          onChange={(e) => set("nodeName", e.target.value)}
        />
      </Field>
      <Field label="Queue size">
        <input
          style={inputStyle}
          type="number"
          value={section.queueSize || 128}
          onChange={(e) => set("queueSize", Number(e.target.value))}
        />
      </Field>
      {rosKey === "ros1" && (
        <Field label="URI">
          <input
            style={inputStyle}
            value={section.uri || ""}
            onChange={(e) => set("uri", e.target.value)}
          />
        </Field>
      )}
      {rosKey === "ros2" && (
        <>
          <Field label="Domain ID">
            <input
              style={inputStyle}
              type="number"
              value={section.domainId || 0}
              onChange={(e) => set("domainId", Number(e.target.value))}
            />
          </Field>
          <Field label="Schema paths (comma-sep)">
            <input
              style={inputStyle}
              value={(section.schemaPaths || []).join(", ")}
              onChange={(e) =>
                set(
                  "schemaPaths",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </Field>
        </>
      )}
      <div style={{ marginTop: "6px" }}>
        <b style={{ fontSize: "13px" }}>Topics</b>
        {topics.map((t, i) => (
          <TopicRow
            key={i}
            topic={t}
            onUpdate={(t) => setTopic(i, t)}
            onRemove={() => removeTopic(i)}
          />
        ))}
        <button style={smallBtn} onClick={addTopic}>
          + Add topic
        </button>
      </div>
    </div>
  );
}

function TopicsTab({ config, onChange }) {
  return (
    <div>
      <RosSection
        label="ROS 1"
        rosKey="ros1"
        config={config}
        onChange={onChange}
      />
      <RosSection
        label="ROS 2"
        rosKey="ros2"
        config={config}
        onChange={onChange}
      />
    </div>
  );
}

function BootTab({ config, onChange }) {
  const boot = config?.boot || {};
  const set = (key, val) =>
    onChange({ ...config, boot: { ...boot, [key]: val } });

  return (
    <div style={sectionStyle}>
      <h5>Boot Policy</h5>
      <Field label="Auto-start store on boot">
        <input
          type="checkbox"
          checked={boot.autoStartStore !== false}
          onChange={(e) => set("autoStartStore", e.target.checked)}
        />
      </Field>
      <Field label="Auto-start bridge on boot">
        <input
          type="checkbox"
          checked={boot.autoStartBridge !== false}
          onChange={(e) => set("autoStartBridge", e.target.checked)}
        />
      </Field>
    </div>
  );
}

const Device = ({ jwt, id, host, ssl }) => {
  const { mqttSync, data, StatusComponent, prefixVersion } = useTransitive({
    jwt,
    id,
    host,
    ssl,
    capability: TR_PKG_NAME,
    versionNS: TR_PKG_VERSION_NS,
  });

  const [tab, setTab] = useState("status");
  const [localConfig, setLocalConfig] = useState(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!mqttSync) return;
    mqttSync.subscribe(`${prefixVersion}/device`);
    mqttSync.subscribe(`${prefixVersion}/config/runtime`);
  }, [mqttSync, prefixVersion]);

  // Seed local config from MQTT when first available
  const remoteConfig = data?.device?.config?.runtime;
  useEffect(() => {
    if (remoteConfig && !localConfig) {
      setLocalConfig(JSON.parse(JSON.stringify(remoteConfig)));
    }
  }, [remoteConfig]);

  const send = (action) => {
    if (!mqttSync) return;
    mqttSync.data.update(`${prefixVersion}/commands/${action}`, {
      requestId: `${Date.now()}`,
      actor: "ui",
      ts: Date.now(),
    });
  };

  const saveConfig = () => {
    if (!mqttSync || !localConfig) return;
    const requestId = `${Date.now()}`;
    for (const section of ["store", "bridge", "ros1", "ros2", "boot"]) {
      if (localConfig[section]) {
        mqttSync.data.update(
          `${prefixVersion}/config/runtime/${section}`,
          localConfig[section],
        );
      }
    }
    setFeedback("Config saved");
    setTimeout(() => setFeedback(null), 3000);
  };

  const saveAndRestart = () => {
    saveConfig();
    setTimeout(() => send("restart"), 500);
    setFeedback("Config saved, restarting...");
    setTimeout(() => setFeedback(null), 5000);
  };

  const cfg = localConfig || remoteConfig || {};
  const tabs = ["status", "store", "bridge", "topics", "boot"];

  return (
    <div>
      <StatusComponent />
      <h4>{capabilityName}</h4>
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #ddd",
          marginBottom: "8px",
        }}
      >
        {tabs.map((t) => (
          <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "status" && <StatusTab data={data} send={send} />}
      {tab === "store" && <StoreTab config={cfg} onChange={setLocalConfig} />}
      {tab === "bridge" && <BridgeTab config={cfg} onChange={setLocalConfig} />}
      {tab === "topics" && <TopicsTab config={cfg} onChange={setLocalConfig} />}
      {tab === "boot" && <BootTab config={cfg} onChange={setLocalConfig} />}

      {tab !== "status" && (
        <div style={{ marginTop: "10px" }}>
          <button style={btnStyle} onClick={saveConfig}>
            Save
          </button>
          <button
            style={{
              ...btnStyle,
              background: "#0078d4",
              color: "#fff",
              border: "none",
              borderRadius: "3px",
            }}
            onClick={saveAndRestart}
          >
            Save &amp; Restart
          </button>
          {feedback && (
            <span
              style={{ marginLeft: "8px", color: "#0078d4", fontSize: "13px" }}
            >
              {feedback}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

createWebComponent(Device, `${capabilityName}-device`, ["jwt"]);
