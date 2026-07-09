import React, { useEffect } from "react";
import { createWebComponent, useTransitive } from "@transitive-sdk/utils-web";

const [scope, capabilityName] = TR_PKG_NAME.split("/");

const cell = { padding: "4px 12px", textAlign: "left", borderBottom: "1px solid #eee" };
const num = { ...cell, textAlign: "right", fontWeight: 600 };

function Row({ label, value }) {
  return (
    <tr>
      <td style={cell}>{label}</td>
      <td style={num}>{value ?? "—"}</td>
    </tr>
  );
}

const Fleet = ({ jwt, id, host, ssl }) => {
  const { mqttSync, data, StatusComponent, prefixVersion, prefixPathVersion } = useTransitive({
    jwt, id, host, ssl,
    capability: TR_PKG_NAME,
    versionNS: TR_PKG_VERSION_NS,
  });

  useEffect(() => {
    if (!mqttSync) return;
    mqttSync.subscribe(`${prefixVersion}/cloud/fleet`);
  }, [mqttSync, prefixVersion]);

  const fleet =
    [...prefixPathVersion, "cloud", "fleet"].reduce((o, k) => (o == null ? o : o[k]), data) || {};
  const updatedAt = fleet.updatedAt ? new Date(fleet.updatedAt).toLocaleString() : "never";

  return (
    <div>
      <StatusComponent />
      <h4>Fleet-wide ReductStore</h4>
      <p style={{ fontSize: "13px", color: "#444", margin: "6px 0" }}>
        There is no UI for controlling fleet-wide aspects of ReductStore yet.
        Please use the device-specific UIs (under "Devices", Device, "reductstore").
      </p>
      <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: "360px", fontSize: "13px" }}>
        <thead>
          <tr>
            <th style={{ ...cell, fontWeight: 600 }}>Metric</th>
            <th style={{ ...num, fontWeight: 600 }}>Count</th>
          </tr>
        </thead>
        <tbody>
          <Row label="Devices total" value={fleet.total} />
          <Row label="Running" value={fleet.running} />
          <Row label="Stopped" value={fleet.stopped} />
          <Row label="Error" value={fleet.error} />
          <Row label="Store running" value={fleet.storeRunning} />
          <Row label="Bridge running" value={fleet.bridgeRunning} />
        </tbody>
      </table>
      <p style={{ fontSize: "12px", color: "#666", marginTop: "6px" }}>Last updated: {updatedAt}</p>
    </div>
  );
};

createWebComponent(Fleet, `${capabilityName}-fleet`, TR_PKG_VERSION);
