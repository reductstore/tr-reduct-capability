export const barBtn = (enabled) => ({
  padding: "6px 14px",
  borderRadius: "3px",
  border: "1px solid #ccc",
  background: "#f3f3f3",
  color: "#222",
  cursor: enabled ? "pointer" : "not-allowed",
  opacity: enabled ? 1 : 0.45,
});

const badgeColor = { running: "#107c10", error: "#d13438", stopped: "#666" };

export const badge = (state) => ({
  background: badgeColor[state] || "#999",
  color: "#fff",
  padding: "2px 10px",
  borderRadius: "10px",
  fontSize: "12px",
  textTransform: "uppercase",
});

export const hint = { fontSize: "12px", color: "#666", margin: "4px 0" };
