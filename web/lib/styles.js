export const row = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  margin: "4px 0",
};
export const labelStyle = { minWidth: "150px", fontSize: "13px" };
export const input = { flex: 1, padding: "4px 6px", fontSize: "13px" };
export const select = { padding: "4px 6px", fontSize: "13px" };
export const num = { width: "90px", padding: "4px 6px", fontSize: "13px" };

const section = {
  margin: "16px 0",
  padding: "12px",
  border: "1px solid #d5dbe2",
  borderRadius: "6px",
  background: "#fcfcfd",
};
export const sectionStyle = (dirty) =>
  dirty
    ? { ...section, borderColor: "#e0a458", background: "#fffdf5" }
    : section;

export const btn = {
  padding: "4px 10px",
  margin: "4px 4px 4px 0",
  fontSize: "13px",
  cursor: "pointer",
};
export const barBtn = (enabled) => ({
  padding: "6px 14px",
  borderRadius: "3px",
  border: "1px solid #ccc",
  background: "#f3f3f3",
  color: "#222",
  cursor: enabled ? "pointer" : "not-allowed",
  opacity: enabled ? 1 : 0.45,
});
export const barPrimary = (enabled) => ({
  ...barBtn(enabled),
  background: "#0078d4",
  color: "#fff",
  border: "1px solid #0078d4",
});
export const hint = { fontSize: "12px", color: "#666", margin: "4px 0" };
