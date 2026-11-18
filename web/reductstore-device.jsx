import React, { useEffect, useState } from "react";
import { createWebComponent, useTransitive } from "@transitive-sdk/utils-web";
import { validateConfig } from "./lib/validate";
import { StoreSection, BridgeSection } from "./lib/sections";
import { btn } from "./lib/styles";

const [, capabilityName] = TR_PKG_NAME.split("/");

const Device = ({ jwt, id, host, ssl }) => {
  const { mqttSync, data, prefixVersion, prefixPathVersion } = useTransitive({
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
  const commandLabel = {
    "start-store": "Starting ReductStore",
    "stop-store": "Stopping ReductStore",
    "restart-store": "Restarting ReductStore",
    "start-bridge": "Starting ReductBridge",
    "stop-bridge": "Stopping ReductBridge",
    "restart-bridge": "Restarting ReductBridge",
  };

  const sendCommand = (action, config) => {
    if (!mqttSync) return;
    mqttSync.data.update(
      `${prefixVersion}/commands/request`,
      JSON.stringify({
        action,
        config,
        requestId: String(Date.now()),
        ts: Date.now(),
      }),
    );
  };
  const control = (action) => {
    sendCommand(action);
    flash(commandLabel[action]);
  };
  const apply = (action, nextCfg = cfg) => {
    const nextIssues = validateConfig(nextCfg);
    if (nextIssues.length > 0) {
      flash(nextIssues[0]);
      return;
    }
    setCfg(nextCfg);
    sendCommand(action, nextCfg);
    flash(`Applying configuration and ${commandLabel[action].toLowerCase()}…`);
  };
  const discard = (section) => {
    if (!remote) return;
    setCfg({ ...cfg, [section]: remote[section] });
  };

  const remote = (() => {
    try {
      return remoteJson ? JSON.parse(remoteJson) : null;
    } catch {
      return null;
    }
  })();
  const differs = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
  const storeDirty = !!cfg && !!remote && differs(cfg.store, remote.store);
  const bridgeDirty = !!cfg && !!remote && differs(cfg.bridge, remote.bridge);

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
  const storePort = device.store?.httpPort || cfg?.store.httpPort;
  const consoleUrl =
    device.store?.host && storePort
      ? `http://${device.store.host}:${storePort}/`
      : null;

  return (
    <div>
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
          [
            "State",
            state,
            state === "running"
              ? "#107c10"
              : state === "error"
                ? "#d13438"
                : "#666",
          ],
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

      {feedback && (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontSize: "12px",
            margin: "6px 0",
            padding: "6px 8px",
            borderRadius: "4px",
            background: "#f4f4f4",
            color: "#555",
            border: "1px solid #eee",
          }}
        >
          {feedback}
        </pre>
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
          <StoreSection
            cfg={cfg}
            setCfg={setCfg}
            dirty={storeDirty}
            dev={device}
            remote={remote}
            consoleUrl={consoleUrl}
            billingValid={billingValid}
            onControl={control}
            onApply={apply}
            onDiscard={() => discard("store")}
          />
          <BridgeSection
            cfg={cfg}
            setCfg={setCfg}
            dirty={bridgeDirty}
            dev={device}
            billingValid={billingValid}
            onControl={control}
            onApply={apply}
            onDiscard={() => discard("bridge")}
          />
        </>
      )}
    </div>
  );
};

createWebComponent(Device, `${capabilityName}-device`, TR_PKG_VERSION);
