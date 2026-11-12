import React from "react";
import { row, labelStyle } from "./styles";

export function Field({ label, children }) {
  return (
    <div style={row}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export function GrowTextarea({ value, onChange, placeholder, minRows = 2 }) {
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={minRows}
      style={{
        width: "100%",
        boxSizing: "border-box",
        resize: "none",
        overflow: "hidden",
        fontFamily: "monospace",
        fontSize: "12px",
        padding: "4px 6px",
      }}
    />
  );
}

export function SectionHead({ title, href }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "8px",
        marginBottom: "8px",
      }}
    >
      <h5 style={{ margin: 0, fontSize: "14px" }}>{title}</h5>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: "12px", color: "#0078d4" }}
        >
          docs
        </a>
      )}
    </div>
  );
}
