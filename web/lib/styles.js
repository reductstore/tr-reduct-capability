export const row = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  margin: "4px 0",
};
export const labelStyle = { minWidth: "150px", fontSize: "13px" };
export const input = { flex: 1, padding: "4px 6px", fontSize: "13px" };

const section = {
  margin: "16px 0",
  padding: "12px",
  border: "1px solid #d5dbe2",
  borderRadius: "6px",
  background: "#fcfcfd",
};
// Amber-highlighted box when the section has unsaved edits.
export const sectionStyle = (dirty) =>
  dirty
    ? { ...section, borderColor: "#e0a458", background: "#fffdf5" }
    : section;

export const btn = {
  padding: "6px 14px",
  margin: "4px 4px 4px 0",
  cursor: "pointer",
};
export const barBtn = (on) => ({
  padding: "6px 14px",
  borderRadius: "3px",
  border: "1px solid #ccc",
  background: "#f3f3f3",
  color: "#222",
  cursor: on ? "pointer" : "not-allowed",
  opacity: on ? 1 : 0.45,
});
export const barPrimary = (on) => ({
  ...barBtn(on),
  background: "#0078d4",
  color: "#fff",
  border: "1px solid #0078d4",
});
export const divider = {
  width: "1px",
  alignSelf: "stretch",
  background: "#ddd",
  margin: "0 4px",
};
export const hint = { fontSize: "12px", color: "#666", margin: "4px 0" };

const badgeColor = { running: "#107c10", error: "#d13438", stopped: "#666" };
export const badge = (state) => ({
  background: badgeColor[state] || "#999",
  color: "#fff",
  padding: "2px 10px",
  borderRadius: "10px",
  fontSize: "12px",
  textTransform: "uppercase",
});

export const dNode = {
  padding: "5px 9px",
  background: "#fff",
  border: "1px solid #cfd8e3",
  borderRadius: "4px",
  fontSize: "11px",
  textAlign: "center",
  lineHeight: 1.2,
};
// External to this capability (not configured here): drawn with a dashed border.
export const dExternal = {
  ...dNode,
  borderStyle: "dashed",
  background: "#fafbfc",
};
export const dArrow = { color: "#8a97a8", fontSize: "15px" };
