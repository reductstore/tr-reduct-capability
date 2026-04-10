import React, { useEffect } from "react";
import { createWebComponent, useTransitive } from "@transitive-sdk/utils-web";

const [scope, capabilityName] = TR_PKG_NAME.split("/");

const cellStyle = {
  padding: "4px 12px",
  textAlign: "left",
  borderBottom: "1px solid #eee",
};
const numStyle = { ...cellStyle, textAlign: "right", fontWeight: 600 };

function SummaryRow({ label, value }) {
  return (
    <tr>
      <td style={cellStyle}>{label}</td>
      <td style={numStyle}>{value ?? "—"}</td>
    </tr>
  );
}

const Fleet = ({ jwt, id, host, ssl }) => {
  const { mqttSync, data, StatusComponent, prefixVersion } = useTransitive({
    jwt,
    id,
    host,
    ssl,
    capability: TR_PKG_NAME,
    versionNS: TR_PKG_VERSION_NS,
  });

  useEffect(() => {
    if (!mqttSync) return;
    mqttSync.subscribe(`${prefixVersion}/cloud/fleet`);
  }, [mqttSync, prefixVersion]);

  const fleet = data?.cloud?.fleet || {};
  const updatedAt = fleet.updatedAt
    ? new Date(fleet.updatedAt).toLocaleString()
    : "never";

  return (
    <div>
      <StatusComponent />
      <h4>{capabilityName} fleet</h4>
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          maxWidth: "400px",
          fontSize: "13px",
        }}
      >
        <thead>
          <tr>
            <th style={{ ...cellStyle, fontWeight: 600 }}>Metric</th>
            <th style={{ ...numStyle, fontWeight: 600 }}>Count</th>
          </tr>
        </thead>
        <tbody>
          <SummaryRow label="Devices running" value={fleet.runningCount} />
          <SummaryRow label="Devices error" value={fleet.errorCount} />
          <SummaryRow label="Devices stopped" value={fleet.stoppedCount} />
          <SummaryRow label="Store running" value={fleet.store?.running} />
          <SummaryRow label="Store stopped" value={fleet.store?.stopped} />
          <SummaryRow label="Store error" value={fleet.store?.error} />
          <SummaryRow label="Bridge running" value={fleet.bridge?.running} />
          <SummaryRow label="Bridge stopped" value={fleet.bridge?.stopped} />
          <SummaryRow label="Bridge error" value={fleet.bridge?.error} />
          <SummaryRow label="Bridge disabled" value={fleet.bridge?.disabled} />
          <SummaryRow
            label="Ingestion configured"
            value={fleet.ingestion?.configured}
          />
          <SummaryRow
            label="Ingestion not configured"
            value={fleet.ingestion?.notConfigured}
          />
        </tbody>
      </table>
      <p style={{ fontSize: "12px", color: "#666", marginTop: "6px" }}>
        Last updated: {updatedAt}
      </p>
    </div>
  );
};

createWebComponent(Fleet, `${capabilityName}-fleet`, ["jwt"]);
