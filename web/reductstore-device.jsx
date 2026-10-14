import React, { useEffect, useState } from "react";
import { createWebComponent, useTransitive } from "@transitive-sdk/utils-web";
import { badge, barBtn, hint } from "./lib/styles";

const [, capabilityName] = TR_PKG_NAME.split("/");

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
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!mqttSync) return;
    mqttSync.subscribe(`${prefixVersion}/device`);
    mqttSync.publish(`${prefixVersion}/commands`);
  }, [mqttSync, prefixVersion]);

  const device =
    [...prefixPathVersion, "device"].reduce(
      (value, key) => (value == null ? value : value[key]),
      data,
    ) || {};
  const state = device.state || "unknown";
  const storeText = device.store?.running
    ? device.store?.alive
      ? "running"
      : "starting"
    : "stopped";
  const bridgeText = device.bridge?.enabled
    ? device.bridge?.running
      ? "running"
      : "stopped"
    : "disabled";
  const error = device.error || device.store?.error || device.bridge?.error;
  const storePort = device.store?.httpPort;
  const consoleUrl =
    device.store?.host && storePort
      ? `http://${device.store.host}:${storePort}/`
      : null;
  const logs = [
    ["ReductStore", device.store?.log],
    ["ReductBridge", device.bridge?.log],
  ].filter(([, log]) => log);

  const sendCommand = (action) => {
    if (!mqttSync) return;
    mqttSync.data.update(
      `${prefixVersion}/commands/request`,
      JSON.stringify({ action, requestId: String(Date.now()), ts: Date.now() }),
    );
    setFeedback(`Sending ${action}...`);
  };

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

      {(feedback || error || device.message) && (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontSize: "12px",
            margin: "6px 0",
            padding: "6px 8px",
            borderRadius: "4px",
            ...(error
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
          {error || feedback || device.message}
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
          style={barBtn(state !== "running")}
          disabled={state === "running"}
          onClick={() => sendCommand("start")}
        >
          Start
        </button>
        <button
          style={barBtn(state !== "stopped")}
          disabled={state === "stopped"}
          onClick={() => sendCommand("stop")}
        >
          Stop
        </button>
        <button style={barBtn(true)} onClick={() => sendCommand("restart")}>
          Restart
        </button>
        {consoleUrl && (
          <a href={consoleUrl} target="_blank" rel="noreferrer">
            Open ReductStore
          </a>
        )}
      </div>

      <p style={hint}>
        Runtime configuration is managed with Transitive Configuration
        Management
        {device.configPath ? ` at ${device.configPath}` : ""}. Restart after a
        managed configuration change.
      </p>

      {logs.length > 0 && (
        <details>
          <summary>Process logs</summary>
          {logs.map(([name, log]) => (
            <div key={name}>
              <strong>{name}</strong>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: "12px",
                  maxHeight: "240px",
                  overflow: "auto",
                }}
              >
                {log}
              </pre>
            </div>
          ))}
        </details>
      )}
    </div>
  );
};

createWebComponent(Device, `${capabilityName}-device`, TR_PKG_VERSION);
