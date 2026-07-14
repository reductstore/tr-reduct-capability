import React from "react";
import { Field, SectionHead } from "./ui";
import { BRIDGE_IMAGES, BRIDGE_TEMPLATES, templateForImage, isTemplateToml } from "./bridge-templates";
import { row, input, btn, hint, sectionStyle } from "./styles";

export function StoreSection({ cfg, setCfg, dirty, onDiscard }) {
  const store = cfg.store;
  const setStore = (k, v) => setCfg({ ...cfg, store: { ...store, [k]: v } });
  const setBucket = (k, v) =>
    setStore("bucket", { ...store.bucket, [k]: v });

  const env = store.env || [];
  const setEnv = (i, k, v) =>
    setStore("env", env.map((e, j) => (j === i ? { ...e, [k]: v } : e)));
  const addEnv = () => setStore("env", [...env, { key: "", value: "" }]);
  const removeEnv = (i) => setStore("env", env.filter((_, j) => j !== i));

  return (
    <div style={sectionStyle(dirty)}>
      <SectionHead
        title="ReductStore, the database on this robot"
        href="https://www.reduct.store/docs/configuration/provisioning"
        dirty={dirty}
        onDiscard={onDiscard}
      >
        Incoming records are stored here in buckets on the robot, configured
        through provisioning env vars.
      </SectionHead>
      <Field label="Image">
        <input
          style={input}
          value={store.image}
          onChange={(e) => setStore("image", e.target.value)}
        />
      </Field>
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
      <Field label="Quota type">
        <select
          value={store.bucket.quotaType}
          onChange={(e) => setBucket("quotaType", e.target.value)}
        >
          <option>NONE</option>
          <option>FIFO</option>
          <option>HARD</option>
        </select>
      </Field>
      {store.bucket.quotaType !== "NONE" && (
        <Field label="Quota size">
          <input
            style={input}
            placeholder="e.g. 1GB"
            value={store.bucket.quotaSize}
            onChange={(e) => setBucket("quotaSize", e.target.value)}
          />
        </Field>
      )}

      <div
        style={{
          margin: "10px 0 4px",
          fontSize: "13px",
          fontWeight: 600,
        }}
      >
        Extra env vars
      </div>
      <p style={hint}>
        Any additional ReductStore settings, applied on top of the fields above.
        If one repeats a setting from above, the value here is used.
      </p>
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
  const setReps = (v) => setCfg({ ...cfg, store: { ...store, replications: v } });
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
  const repStatus = (name) =>
    (dev.store?.replications || []).find((t) => t.name === name);
  const orphanReps = (dev.store?.replications || [])
    .map((t) => t.name)
    .filter(
      (n) => n && !(remote?.store?.replications || []).some((r) => r.name === n),
    );

  return (
    <div style={sectionStyle(dirty)}>
      <SectionHead
        title="Replication, send new data to a remote ReductStore"
        href="https://www.reduct.store/docs/guides/data-replication"
        dirty={dirty}
        onDiscard={onDiscard}
      >
        As records are written to a local bucket, they are also sent to a remote
        or cloud ReductStore. It only adds new records, never changing or
        deleting existing data. Optionally send only the records that match a
        "when" filter. Tasks are provisioned on the store, so changes apply on
        Apply &amp; Restart.
      </SectionHead>
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
              style={input}
              value={r.mode || "enabled"}
              onChange={(e) => setRep(i, "mode", e.target.value)}
            >
              <option value="enabled">enabled</option>
              <option value="paused">paused</option>
              <option value="disabled">disabled</option>
            </select>
          </Field>
          <div style={{ margin: "4px 0" }}>
            <label style={{ fontSize: "13px" }}>Filter, "when" (optional)</label>
            <textarea
              style={{
                width: "100%",
                minHeight: "70px",
                fontFamily: "monospace",
                fontSize: "12px",
              }}
              placeholder='JSON condition, e.g. {"&temperature": {"$gt": 10}}'
              value={r.when || ""}
              onChange={(e) => setRep(i, "when", e.target.value)}
            />
            <p style={{ ...hint, margin: "2px 0 0" }}>
              Only replicate records matching this condition. Leave empty to
              replicate everything.
            </p>
          </div>
          {repStatus(r.name) && (
            <p style={hint}>
              on device:{" "}
              <b>
                {repStatus(r.name).is_provisioned
                  ? "provisioned"
                  : "unprovisioned"}
              </b>
              {" · "}
              {repStatus(r.name).is_active ? "active" : "inactive"}
              {" · pending: "}
              {repStatus(r.name).pending_records}
            </p>
          )}
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
    setBridge("env", env.map((e, j) => (j === i ? { ...e, [k]: v } : e)));
  const addEnv = () => setBridge("env", [...env, { key: "", value: "" }]);
  const removeEnv = (i) => setBridge("env", env.filter((_, j) => j !== i));

  const mounts = bridge.mounts || [];
  const setMount = (i, v) =>
    setBridge("mounts", mounts.map((m, j) => (j === i ? v : m)));
  const addMount = () => setBridge("mounts", [...mounts, ""]);
  const removeMount = (i) =>
    setBridge("mounts", mounts.filter((_, j) => j !== i));

  const imageKnown = BRIDGE_IMAGES.some((im) => im.value === bridge.image);
  const isRos2 = /ros2/i.test(bridge.image || "");

  // Swap the template too when the TOML is still an unedited template.
  const changeImage = (image) => {
    const tmpl = templateForImage(image);
    const next = { ...bridge, image };
    if (tmpl && isTemplateToml(bridge.toml, cfg.store, bridge.image))
      next.toml = tmpl.build(cfg.store, image);
    setCfg({ ...cfg, bridge: next });
  };
  const loadTemplate = (label) => {
    const tmpl = BRIDGE_TEMPLATES.find((t) => t.label === label);
    if (tmpl) setBridge("toml", tmpl.build(cfg.store, bridge.image));
  };

  return (
    <div style={sectionStyle(dirty)}>
      <SectionHead
        title="ReductBridge, record data into the store"
        href="https://www.reduct.store/docs/reduct-bridge"
        dirty={dirty}
        onDiscard={onDiscard}
      >
        Writes incoming data into the local ReductStore. Configured with the
        TOML below.
      </SectionHead>
      <Field label="Enabled">
        <input
          type="checkbox"
          checked={!!bridge.enabled}
          onChange={(e) => setBridge("enabled", e.target.checked)}
        />
      </Field>
      <Field label="Image family">
        <select
          style={input}
          value={imageKnown ? bridge.image : ""}
          onChange={(e) => changeImage(e.target.value)}
        >
          {!imageKnown && (
            <option value="" disabled>
              Custom (see tag below)
            </option>
          )}
          {BRIDGE_IMAGES.map((im) => (
            <option key={im.value} value={im.value}>
              {im.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Image tag">
        <input
          style={input}
          placeholder="reduct/bridge:tag"
          value={bridge.image}
          onChange={(e) => setBridge("image", e.target.value)}
        />
      </Field>
      {isRos2 && (
        <Field label="ROS_DOMAIN_ID">
          <input
            style={input}
            type="number"
            value={bridge.rosDomainId ?? ""}
            onChange={(e) =>
              setBridge(
                "rosDomainId",
                e.target.value === "" ? "" : Number(e.target.value),
              )
            }
          />
        </Field>
      )}
      <div
        style={{
          margin: "10px 0 4px",
          fontSize: "13px",
          fontWeight: 600,
        }}
      >
        Extra mounts (host dirs)
      </div>
      <p style={hint}>
        Optional volume mounts. Host directories mounted read only into the
        container at the same path, for example a ROS 2 workspace with custom
        message schemas the TOML references.
      </p>
      {mounts.map((m, i) => (
        <div key={i} style={row}>
          <input
            style={input}
            placeholder="/home/user/ros2_ws/install"
            value={m || ""}
            onChange={(ev) => setMount(i, ev.target.value)}
          />
          <button style={btn} onClick={() => removeMount(i)}>
            ×
          </button>
        </div>
      ))}
      <button style={btn} onClick={addMount}>
        Add mount
      </button>

      <div
        style={{
          margin: "10px 0 4px",
          fontSize: "13px",
          fontWeight: 600,
        }}
      >
        Extra env vars
      </div>
      <p style={hint}>
        Optional. Extra environment variables for the bridge container.
      </p>
      {env.map((e, i) => (
        <div key={i} style={row}>
          <input
            style={{ ...input, maxWidth: "220px" }}
            placeholder="RUST_LOG"
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "6px",
          }}
        >
          <label style={{ fontSize: "13px" }}>config.toml</label>
          <select
            style={{ fontSize: "12px", padding: "2px 4px" }}
            value=""
            onChange={(e) => {
              if (e.target.value) loadTemplate(e.target.value);
            }}
          >
            <option value="">Load template…</option>
            {BRIDGE_TEMPLATES.map((t) => (
              <option key={t.label} value={t.label}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          style={{
            width: "100%",
            minHeight: "420px",
            fontFamily: "monospace",
            fontSize: "12px",
          }}
          value={bridge.toml}
          onChange={(e) => setBridge("toml", e.target.value)}
        />
      </div>
    </div>
  );
}
