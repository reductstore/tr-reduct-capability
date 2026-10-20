import React from "react";
import { row, labelStyle, hint } from "./styles";

export function Field({ label, children }) {
  return (
    <div style={row}>
      <label style={labelStyle}>{label}</label>
      {children}
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
