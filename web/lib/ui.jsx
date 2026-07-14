import React from "react";
import { row, labelStyle, hint, dNode, dExternal, dArrow } from "./styles";

export function Field({ label, children }) {
  return (
    <div style={row}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export function Pipeline({ consoleUrl }) {
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

export function SectionHead({ title, href, dirty, onDiscard, children }) {
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
