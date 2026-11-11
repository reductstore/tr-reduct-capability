import React, { useEffect, useState } from "react";
import { createWebComponent, useTransitive } from "@transitive-sdk/utils-web";
import { validateConfig } from "./lib/validate";
import {
  StoreSection,
  ReplicationSection,
  BridgeSection,
} from "./lib/sections";
import { barBtn, barPrimary, divider, btn, hint, linkBtn } from "./lib/styles";

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

  const device =
    [...prefixPathVersion, "device"].reduce(
      (value, key) => (value == null ? value : value[key]),
      data,
    ) || {};
  const remoteJson = device.config?.json;

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
      JSON.stringify({ action, requestId: String(Date.now()), ts: Date.now() }),
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
  const reps = device.store?.replications || [];
  const repActive = reps.filter((r) => r.is_active).length;
  const repPending = reps.reduce((s, r) => s + (r.pending_records || 0), 0);

  const billingValid = device.billing?.state === "valid";
  const error = device.error || device.store?.error || device.bridge?.error;
  const canStart = state !== "running" && billingValid;
  const canStop = state !== "stopped";
  const canRestart = billingValid;
  const storePort = device.store?.httpPort || cfg?.store.httpPort;
  const consoleUrl =
    device.store?.host && storePort
      ? `http://${device.store.host}:${storePort}/`
      : null;
  const logs = [
    ["ReductStore", device.store?.log],
    ["ReductBridge", device.bridge?.log],
  ].filter(([, log]) => log);

  return (
    <div>
      <StatusComponent />
      <h4>Reduct</h4>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "2px 12px",
          fontSize: "13px",
          margin: "8px 0",
          maxWidth: "340px",
        }}
      >
        {[
          ["State", state, state === "running" ? "#107c10" : "#666"],
          [
            "Billing",
            billingValid ? "valid" : "invalid",
            billingValid ? "#107c10" : "#d13438",
          ],
          ["Store", storeText, null],
          ["Bridge", bridgeText, null],
          ...(reps.length
            ? [
                [
                  "Replication",
                  `${repActive}/${reps.length} active · ${repPending} pending`,
                  null,
                ],
              ]
            : []),
        ].map(([label, value, color]) => (
          <React.Fragment key={label}>
            <span style={{ color: "#888" }}>{label}</span>
            <b style={color ? { color } : undefined}>{value}</b>
          </React.Fragment>
        ))}
      </div>

      {(error || feedback || device.message) && (
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
        <button
          style={barBtn(canRestart)}
          disabled={!canRestart}
          onClick={() => control("restart")}
        >
          Restart
        </button>
        <span style={divider} />
        <button
          style={barPrimary(dirty && issues.length === 0)}
          disabled={!dirty || issues.length > 0}
          onClick={apply}
        >
          Apply &amp; restart
        </button>
        <button style={barBtn(dirty)} disabled={!dirty} onClick={discard}>
          Discard
        </button>
        {consoleUrl && (
          <a href={consoleUrl} target="_blank" rel="noreferrer" style={linkBtn}>
            Open ReductStore
          </a>
        )}
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
          <ReplicationSection
            cfg={cfg}
            setCfg={setCfg}
            dev={device}
            remote={remote}
            consoleUrl={consoleUrl}
            dirty={repsDirty}
            onDiscard={discardReps}
          />
          <StoreSection
            cfg={cfg}
            setCfg={setCfg}
            dirty={storeDirty}
            onDiscard={discardStore}
          />
          <BridgeSection
            cfg={cfg}
            setCfg={setCfg}
            dirty={bridgeDirty}
            onDiscard={discardBridge}
          />
        </>
      )}

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
