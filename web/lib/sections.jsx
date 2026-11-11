import React from "react";
import { Field, SectionHead, GrowTextarea } from "./ui";
import {
  VARIANTS,
  PRESETS,
  presetForVariant,
  renderPreset,
  isPresetToml,
} from "./presets";
import { row, input, select, btn, hint, sectionStyle } from "./styles";

export function StoreSection({ cfg, setCfg, dirty, onDiscard }) {
  const store = cfg.store;
  const setStore = (k, v) => setCfg({ ...cfg, store: { ...store, [k]: v } });
  const setBucket = (k, v) => setStore("bucket", { ...store.bucket, [k]: v });

  const env = store.env || [];
  const setEnv = (i, k, v) =>
    setStore(
      "env",
      env.map((e, j) => (j === i ? { ...e, [k]: v } : e)),
    );
  const addEnv = () => setStore("env", [...env, { key: "", value: "" }]);
  const removeEnv = (i) =>
    setStore(
      "env",
      env.filter((_, j) => j !== i),
    );

  return (
    <div style={sectionStyle(dirty)}>
      <SectionHead
        title="ReductStore"
        href="https://www.reduct.store/docs/configuration/provisioning"
        dirty={dirty}
        onDiscard={onDiscard}
      />
      <Field label="HTTP port">
        <input
          style={input}
          type="number"
          value={store.httpPort}
          onChange={(e) => setStore("httpPort", Number(e.target.value))}
        />
      </Field>
      <Field label="Data path">
        <input
          style={input}
          value={store.dataPath}
          onChange={(e) => setStore("dataPath", e.target.value)}
        />
      </Field>
      <Field label="API token">
        <input
          style={input}
          value={store.apiToken}
          onChange={(e) => setStore("apiToken", e.target.value)}
        />
      </Field>
      <Field label="Bucket name">
        <input
          style={input}
          value={store.bucket.name}
          onChange={(e) => setBucket("name", e.target.value)}
        />
      </Field>
      <Field label="Quota">
        <select
          style={select}
          value={store.bucket.quotaType}
          onChange={(e) => setBucket("quotaType", e.target.value)}
        >
          <option>NONE</option>
          <option>FIFO</option>
          <option>HARD</option>
        </select>
        {store.bucket.quotaType !== "NONE" && (
          <input
            style={input}
            placeholder="1GB"
            value={store.bucket.quotaSize}
            onChange={(e) => setBucket("quotaSize", e.target.value)}
          />
        )}
      </Field>

      <div style={{ margin: "10px 0 4px", fontSize: "13px", fontWeight: 600 }}>
        Extra environment variables (optional)
      </div>
      {env.map((e, i) => (
        <div key={i} style={row}>
          <input
            style={{ ...input, maxWidth: "220px" }}
            placeholder="RS_LOG_LEVEL"
            value={e.key || ""}
            onChange={(ev) => setEnv(i, "key", ev.target.value)}
          />
          <span>=</span>
          <input
            style={input}
            placeholder="value"
            value={e.value || ""}
            onChange={(ev) => setEnv(i, "value", ev.target.value)}
          />
          <button style={btn} onClick={() => removeEnv(i)}>
            ×
          </button>
        </div>
      ))}
      <button style={btn} onClick={addEnv}>
        Add variable
      </button>
    </div>
  );
}

export function ReplicationSection({
  cfg,
  setCfg,
  dev,
  remote,
  consoleUrl,
  dirty,
  onDiscard,
}) {
  const store = cfg.store;
  const reps = store.replications || [];
  const setReps = (v) =>
    setCfg({ ...cfg, store: { ...store, replications: v } });
  const setRep = (i, k, v) =>
    setReps(reps.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const addRep = () =>
    setReps([
      ...reps,
      {
        name: "",
        srcBucket: store.bucket.name,
        dstBucket: "",
        dstHost: "",
        dstToken: "",
        entries: "",
        when: "",
        mode: "enabled",
      },
    ]);
  const removeRep = (i) => setReps(reps.filter((_, j) => j !== i));
  const orphanReps = (dev.store?.replications || [])
    .map((t) => t.name)
    .filter(
      (n) =>
        n && !(remote?.store?.replications || []).some((r) => r.name === n),
    );

  return (
    <div style={sectionStyle(dirty)}>
      <SectionHead
        title="Replication"
        href="https://www.reduct.store/docs/guides/data-replication"
        dirty={dirty}
        onDiscard={onDiscard}
      />
      {reps.map((r, i) => (
        <div
          key={i}
          style={{
            border: "1px solid #eee",
            borderRadius: "4px",
            padding: "6px",
            margin: "6px 0",
          }}
        >
          <Field label="Name">
            <input
              style={input}
              value={r.name || ""}
              onChange={(e) => setRep(i, "name", e.target.value)}
            />
          </Field>
          <Field label="Source bucket">
            <input
              style={input}
              value={r.srcBucket || ""}
              onChange={(e) => setRep(i, "srcBucket", e.target.value)}
            />
          </Field>
          <Field label="Dest bucket">
            <input
              style={input}
              value={r.dstBucket || ""}
              onChange={(e) => setRep(i, "dstBucket", e.target.value)}
            />
          </Field>
          <Field label="Dest host">
            <input
              style={input}
              placeholder="https://play.reduct.store"
              value={r.dstHost || ""}
              onChange={(e) => setRep(i, "dstHost", e.target.value)}
            />
          </Field>
          <Field label="Dest token">
            <input
              style={input}
              value={r.dstToken || ""}
              onChange={(e) => setRep(i, "dstToken", e.target.value)}
            />
          </Field>
          <Field label="Entries">
            <input
              style={input}
              placeholder="entry1, entry2 (optional, all if empty)"
              value={r.entries || ""}
              onChange={(e) => setRep(i, "entries", e.target.value)}
            />
          </Field>
          <Field label="Mode">
            <select
              style={select}
              value={r.mode || "enabled"}
              onChange={(e) => setRep(i, "mode", e.target.value)}
            >
              <option value="enabled">enabled</option>
              <option value="paused">paused</option>
              <option value="disabled">disabled</option>
            </select>
          </Field>
          <div style={{ margin: "4px 0" }}>
            <label style={{ fontSize: "13px" }}>
              Filter, "when" (optional)
            </label>
            <GrowTextarea
              value={r.when || ""}
              onChange={(e) => setRep(i, "when", e.target.value)}
              placeholder='JSON condition, e.g. {"&temperature": {"$gt": 10}}'
              minRows={2}
            />
          </div>
          <button style={btn} onClick={() => removeRep(i)}>
            Remove task
          </button>
        </div>
      ))}
      {orphanReps.length > 0 && (
        <p style={{ ...hint, color: "#b26a00" }}>
          ⚠ {orphanReps.map((n) => `"${n}"`).join(", ")}{" "}
          {orphanReps.length > 1 ? "are" : "is"} on the device but not managed
          here (e.g. created manually).
          {consoleUrl && (
            <>
              {" "}
              Delete {orphanReps.length > 1 ? "them" : "it"} in the{" "}
              <a href={consoleUrl} target="_blank" rel="noreferrer">
                ReductStore console
              </a>{" "}
              if unwanted.
            </>
          )}
        </p>
      )}
      <button style={btn} onClick={addRep}>
        Add replication task
      </button>
    </div>
  );
}

export function BridgeSection({ cfg, setCfg, dirty, onDiscard }) {
  const bridge = cfg.bridge;
  const setBridge = (k, v) => setCfg({ ...cfg, bridge: { ...bridge, [k]: v } });

  const env = bridge.env || [];
  const setEnv = (i, k, v) =>
    setBridge(
      "env",
      env.map((e, j) => (j === i ? { ...e, [k]: v } : e)),
    );
  const addEnv = () => setBridge("env", [...env, { key: "", value: "" }]);
  const removeEnv = (i) =>
    setBridge(
      "env",
      env.filter((_, j) => j !== i),
    );

  // Switching variant also swaps the preset, and re-renders the TOML only when
  // the operator has not hand-edited it.
  const changeVariant = (variant) => {
    const preset = presetForVariant(variant);
    const unedited = isPresetToml(bridge.toml, cfg.store, bridge.variant);
    let env = bridge.env || [];
    const isRos2 = variant.startsWith("ros2");
    if (isRos2 && !env.some((e) => e.key === "ROS_DOMAIN_ID")) {
      env = [...env, { key: "ROS_DOMAIN_ID", value: "0" }];
    } else if (!isRos2) {
      env = env.filter((e) => e.key !== "ROS_DOMAIN_ID");
    }
    setCfg({
      ...cfg,
      bridge: {
        ...bridge,
        variant,
        preset,
        env,
        toml: unedited ? "" : bridge.toml,
      },
    });
  };
  const rendered = renderPreset(bridge.preset, cfg.store, bridge.variant);

  return (
    <div style={sectionStyle(dirty)}>
      <SectionHead
        title="ReductBridge"
        href="https://www.reduct.store/docs/reduct-bridge"
        dirty={dirty}
        onDiscard={onDiscard}
      />
      <Field label="Enabled">
        <input
          type="checkbox"
          checked={!!bridge.enabled}
          onChange={(e) => setBridge("enabled", e.target.checked)}
        />
      </Field>
      <Field label="Variant">
        <select
          style={select}
          value={bridge.variant}
          onChange={(e) => changeVariant(e.target.value)}
        >
          {VARIANTS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </Field>
      {bridge.variant === "iot" && (
        <Field label="Protocol">
          <select
            style={select}
            value={bridge.preset}
            onChange={(e) => setBridge("preset", e.target.value)}
          >
            {PRESETS.filter((p) =>
              ["mqtt", "http", "shell"].includes(p.value),
            ).map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div style={{ margin: "10px 0 4px", fontSize: "13px", fontWeight: 600 }}>
        Extra environment variables (optional)
      </div>
      {env.map((e, i) => (
        <div key={i} style={row}>
          <input
            style={{ ...input, maxWidth: "220px" }}
            placeholder={
              bridge.variant.startsWith("ros2") ? "ROS_DOMAIN_ID" : "RUST_LOG"
            }
            value={e.key || ""}
            onChange={(ev) => setEnv(i, "key", ev.target.value)}
          />
          <span>=</span>
          <input
            style={input}
            placeholder="value"
            value={e.value || ""}
            onChange={(ev) => setEnv(i, "value", ev.target.value)}
          />
          <button style={btn} onClick={() => removeEnv(i)}>
            ×
          </button>
        </div>
      ))}
      <button style={btn} onClick={addEnv}>
        Add variable
      </button>

      <div style={{ margin: "6px 0" }}>
        <label
          style={{ fontSize: "13px", display: "block", marginBottom: "6px" }}
        >
          config.toml
        </label>
        <GrowTextarea
          value={bridge.toml || rendered}
          onChange={(e) =>
            setBridge("toml", e.target.value === rendered ? "" : e.target.value)
          }
          placeholder={`# empty → uses the ${bridge.preset} preset`}
          minRows={3}
        />
      </div>
    </div>
  );
}
