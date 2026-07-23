import React, { useEffect, useState } from "react";
import { createWebComponent, useTransitive } from "@transitive-sdk/utils-web";
import { validateConfig } from "./lib/validate";
import { Pipeline } from "./lib/ui";
import {
  StoreSection,
  ReplicationSection,
  BridgeSection,
} from "./lib/sections";
import { badge, barBtn, barPrimary, divider, btn, hint } from "./lib/styles";

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

  const issues = cfg ? validateConfig(cfg) : [];

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
          <StoreSection
            cfg={cfg}
            setCfg={setCfg}
            dirty={storeDirty}
            onDiscard={discardStore}
          />
          <ReplicationSection
            cfg={cfg}
            setCfg={setCfg}
            dev={dev}
            remote={remote}
            consoleUrl={consoleUrl}
            dirty={repsDirty}
            onDiscard={discardReps}
          />
          <BridgeSection
            cfg={cfg}
            setCfg={setCfg}
            dirty={bridgeDirty}
            onDiscard={discardBridge}
          />
        </>
      )}
    </div>
  );
};

createWebComponent(Device, `${capabilityName}-device`, TR_PKG_VERSION);
