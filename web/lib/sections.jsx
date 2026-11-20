import React from "react";
import { Button, Card, Form, InputGroup } from "react-bootstrap";
import {
  Field,
  SectionHead,
  GrowTextarea,
  ComponentLog,
  StatusBadge,
} from "./ui";
import {
  VARIANTS,
  PRESETS,
  presetForVariant,
  renderPreset,
  isPresetToml,
} from "./presets";

function cardProps(dirty) {
  return {
    className: "mb-3",
    border: dirty ? "warning" : undefined,
  };
}

function EnvEditor({ env, setEnv, addEnv, removeEnv, placeholder }) {
  return (
    <>
      <div className="fw-semibold mt-3 mb-2">Extra environment variables</div>
      {env.map((e, i) => (
        <InputGroup key={i} className="mb-2" style={{ maxWidth: "520px" }}>
          <Form.Control
            placeholder={placeholder}
            value={e.key || ""}
            onChange={(ev) => setEnv(i, "key", ev.target.value)}
          />
          <InputGroup.Text>=</InputGroup.Text>
          <Form.Control
            placeholder="value"
            value={e.value || ""}
            onChange={(ev) => setEnv(i, "value", ev.target.value)}
          />
          <Button variant="outline-secondary" onClick={() => removeEnv(i)}>
            ×
          </Button>
        </InputGroup>
      ))}
      <Button variant="outline-secondary" size="sm" onClick={addEnv}>
        Add variable
      </Button>
    </>
  );
}

export function StoreSection({ cfg, setCfg, dirty, dev, remote }) {
  const store = cfg.store;
  const setStore = (k, v) => setCfg({ ...cfg, store: { ...store, [k]: v } });
  const setBucket = (k, v) => setStore("bucket", { ...store.bucket, [k]: v });
  const env = store.env || [];
  const setEnv = (i, k, v) =>
    setStore(
      "env",
      env.map((e, j) => (j === i ? { ...e, [k]: v } : e)),
    );

  return (
    <Card {...cardProps(dirty)}>
      <SectionHead
        title="ReductStore"
        href="https://www.reduct.store/docs/configuration/provisioning"
      >
        <StatusBadge state={storeState(dev)} />
      </SectionHead>
      <Card.Body>
        <Field label="HTTP port">
          <Form.Control
            type="number"
            style={{ maxWidth: "140px" }}
            value={store.httpPort}
            onChange={(e) => setStore("httpPort", Number(e.target.value))}
          />
        </Field>
        <Field label="Data path">
          <Form.Control
            value={store.dataPath}
            onChange={(e) => setStore("dataPath", e.target.value)}
          />
        </Field>
        <Field label="API token">
          <Form.Control
            value={store.apiToken}
            onChange={(e) => setStore("apiToken", e.target.value)}
          />
        </Field>
        <Field label="Bucket name">
          <Form.Control
            value={store.bucket.name}
            onChange={(e) => setBucket("name", e.target.value)}
          />
        </Field>
        <Field label="Quota">
          <Form.Select
            style={{ maxWidth: "140px" }}
            value={store.bucket.quotaType}
            onChange={(e) => setBucket("quotaType", e.target.value)}
          >
            <option>NONE</option>
            <option>FIFO</option>
            <option>HARD</option>
          </Form.Select>
          {store.bucket.quotaType !== "NONE" && (
            <Form.Control
              style={{ maxWidth: "140px" }}
              placeholder="1GB"
              value={store.bucket.quotaSize}
              onChange={(e) => setBucket("quotaSize", e.target.value)}
            />
          )}
        </Field>

        <ReplicationSection
          cfg={cfg}
          setCfg={setCfg}
          dev={dev}
          remote={remote}
        />

        <EnvEditor
          env={env}
          setEnv={setEnv}
          addEnv={() => setStore("env", [...env, { key: "", value: "" }])}
          removeEnv={(i) =>
            setStore(
              "env",
              env.filter((_, j) => j !== i),
            )
          }
          placeholder="RS_LOG_LEVEL"
        />

        <ComponentLog name="ReductStore" log={dev.store?.log} />
      </Card.Body>
    </Card>
  );
}

function storeState(dev) {
  if (dev.store?.error) return "error";
  if (!dev.store?.running) return "stopped";
  return dev.store?.alive ? "running" : "starting";
}

function bridgeState(dev, enabled) {
  if (!enabled) return "disabled";
  if (dev.bridge?.error) return "error";
  return dev.bridge?.running ? "running" : "stopped";
}

export function ReplicationSection({ cfg, setCfg, dev, remote }) {
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
    <div className="mt-4">
      <div className="fw-semibold mb-2">
        Replication{" "}
        <a
          href="https://www.reduct.store/docs/guides/data-replication"
          target="_blank"
          rel="noreferrer"
          className="small fw-normal"
        >
          docs
        </a>
      </div>
      <ReplicationStatus dev={dev} />
      {reps.map((r, i) => (
        <Card key={i} className="mb-2 bg-body-tertiary">
          <Card.Body className="py-2">
            <Field label="Name">
              <Form.Control
                value={r.name || ""}
                onChange={(e) => setRep(i, "name", e.target.value)}
              />
            </Field>
            <Field label="Source bucket">
              <Form.Control
                value={r.srcBucket || ""}
                onChange={(e) => setRep(i, "srcBucket", e.target.value)}
              />
            </Field>
            <Field label="Dest bucket">
              <Form.Control
                value={r.dstBucket || ""}
                onChange={(e) => setRep(i, "dstBucket", e.target.value)}
              />
            </Field>
            <Field label="Dest host">
              <Form.Control
                placeholder="https://play.reduct.store"
                value={r.dstHost || ""}
                onChange={(e) => setRep(i, "dstHost", e.target.value)}
              />
            </Field>
            <Field label="Dest token">
              <Form.Control
                value={r.dstToken || ""}
                onChange={(e) => setRep(i, "dstToken", e.target.value)}
              />
            </Field>
            <Field label="Entries">
              <Form.Control
                placeholder="entry1, entry2 (all if empty)"
                value={r.entries || ""}
                onChange={(e) => setRep(i, "entries", e.target.value)}
              />
            </Field>
            <Field label="Mode">
              <Form.Select
                style={{ maxWidth: "160px" }}
                value={r.mode || "enabled"}
                onChange={(e) => setRep(i, "mode", e.target.value)}
              >
                <option value="enabled">enabled</option>
                <option value="paused">paused</option>
                <option value="disabled">disabled</option>
              </Form.Select>
            </Field>
            <Field label='Filter, "when"'>
              <GrowTextarea
                value={r.when || ""}
                onChange={(e) => setRep(i, "when", e.target.value)}
                placeholder='JSON condition, e.g. {"&temperature": {"$gt": 10}}'
                minRows={2}
              />
            </Field>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => removeRep(i)}
            >
              Remove task
            </Button>
          </Card.Body>
        </Card>
      ))}
      {orphanReps.length > 0 && (
        <p className="small text-warning-emphasis">
          ⚠ {orphanReps.map((n) => `"${n}"`).join(", ")}{" "}
          {orphanReps.length > 1 ? "are" : "is"} on the device but not managed
          here (e.g. created manually).
        </p>
      )}
      <Button variant="outline-secondary" size="sm" onClick={addRep}>
        Add replication task
      </Button>
    </div>
  );
}

export function BridgeSection({ cfg, setCfg, dirty, dev }) {
  const bridge = cfg.bridge;
  const setBridge = (k, v) => setCfg({ ...cfg, bridge: { ...bridge, [k]: v } });
  const env = bridge.env || [];
  const setEnv = (i, k, v) =>
    setBridge(
      "env",
      env.map((e, j) => (j === i ? { ...e, [k]: v } : e)),
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
    <Card {...cardProps(dirty)}>
      <SectionHead
        title="ReductBridge"
        href="https://www.reduct.store/docs/reduct-bridge"
      >
        <span className="d-flex align-items-center gap-3">
          <StatusBadge state={bridgeState(dev, bridge.enabled)} />
          <Form.Check
            type="switch"
            id="bridge-enabled"
            label="Enabled"
            checked={!!bridge.enabled}
            onChange={(e) => setBridge("enabled", e.target.checked)}
          />
        </span>
      </SectionHead>
      {bridge.enabled && (
        <Card.Body>
          <Field label="Variant">
            <Form.Select
              style={{ maxWidth: "240px" }}
              value={bridge.variant}
              onChange={(e) => changeVariant(e.target.value)}
            >
              {VARIANTS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </Form.Select>
          </Field>
          {bridge.variant === "iot" && (
            <Field label="Protocol">
              <Form.Select
                style={{ maxWidth: "240px" }}
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
              </Form.Select>
            </Field>
          )}

          <EnvEditor
            env={env}
            setEnv={setEnv}
            addEnv={() => setBridge("env", [...env, { key: "", value: "" }])}
            removeEnv={(i) =>
              setBridge(
                "env",
                env.filter((_, j) => j !== i),
              )
            }
            placeholder={
              bridge.variant.startsWith("ros2") ? "ROS_DOMAIN_ID" : "RUST_LOG"
            }
          />

          <div className="fw-semibold mt-3 mb-2">config.toml</div>
          <GrowTextarea
            value={bridge.toml || rendered}
            onChange={(e) =>
              setBridge(
                "toml",
                e.target.value === rendered ? "" : e.target.value,
              )
            }
            placeholder={`# empty → uses the ${bridge.preset} preset`}
            minRows={3}
          />

          <ComponentLog name="ReductBridge" log={dev.bridge?.log} />
        </Card.Body>
      )}
    </Card>
  );
}

export function ControlBar({
  dirty,
  billingValid,
  canStart,
  canStop,
  onControl,
  onApply,
  onDiscard,
}) {
  return (
    <div className="d-flex flex-wrap gap-2 mb-3">
      <Button
        variant="outline-secondary"
        disabled={!billingValid || !canStart}
        onClick={() => onControl("start")}
      >
        Start
      </Button>
      <Button
        variant="outline-secondary"
        disabled={!canStop}
        onClick={() => onControl("stop")}
      >
        Stop
      </Button>
      <Button
        variant="primary"
        className="ms-auto"
        disabled={!billingValid || !dirty}
        onClick={onApply}
      >
        Apply &amp; restart
      </Button>
      <Button variant="outline-secondary" disabled={!dirty} onClick={onDiscard}>
        Discard
      </Button>
    </div>
  );
}

function ReplicationStatus({ dev }) {
  const reps = dev.store?.replications || [];
  if (!reps.length) return null;
  const active = reps.filter((r) => r.is_active).length;
  const pending = reps.reduce((s, r) => s + (r.pending_records || 0), 0);
  return (
    <div className="small text-secondary mb-2">
      {active}/{reps.length} active · {pending} pending
    </div>
  );
}
