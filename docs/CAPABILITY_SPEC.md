# ReductStore Capability Spec (Transitive Robotics)

Status: Draft v0.1 (for review)

## 1) Goal

Provide a Transitive Robotics capability that can **install/configure/operate ReductStore on robot devices** and expose:

- device-level lifecycle control (start/stop/restart/redeploy)
- runtime health/status telemetry
- secure auth/token handling guidance
- optional fleet aggregation (cloud component)

This spec is intentionally v1-focused on **robot control first**.

---

## 2) Ground truth from docs

### Transitive capability model
- Capability is a full-stack package (robot/cloud/web) versioned together.
- Robot and cloud communicate via MQTTSync with namespaced topics.
- Starter pattern includes top-level `start`/`cloud` scripts and robot/cloud/web subpackages.

### ReductStore operational model
- Docker run with persistent data volume is standard for quick start.
- `RS_API_TOKEN` enables auth and acts as initial full-access token.
- Clients send token in `Authorization` header.
- Liveness endpoint: `GET /api/v1/alive`.

---

## 3) Scope

## In scope (v1)
1. Robot component controls local ReductStore runtime.
2. Publishes state + health via MQTTSync.
3. Receives control commands from cloud/UI.
4. Configurable runtime parameters (image, port, data dir, auth mode).
5. Minimal cloud stub and minimal device UI.

## Out of scope (v1)
- advanced fleet orchestration and scheduling
- backup/restore workflows
- replication task automation
- deep web console parity

---

## 4) Package layout

```
tr-reduct-capability/
  package.json
  subScript.sh
  robot/
    package.json
    main.js
    lib/reductstore-runtime.js
  cloud/
    package.json
    main.js
  web/
    device.jsx
    fleet.jsx
  docs/
    CAPABILITY_SPEC.md
```

---

## 5) Capability data contract (MQTTSync)

All paths below are capability-local (after Transitive namespace slicing).

## Desired config
- `/config/enabled: boolean` — desired running state.
- `/config/runtime/mode: "docker" | "binary"` (default `docker`).
- `/config/runtime/image: string` (e.g. `reductstore/reductstore:latest`).
- `/config/runtime/containerName: string` (default `reductstore`).
- `/config/runtime/httpPort: number` (default `8383`).
- `/config/runtime/dataPath: string` (host path for persistent data).
- `/config/auth/enabled: boolean`.
- `/config/auth/tokenRef: string` (reference/key-id only, never raw token in MQTT).

## Commands (write-once events)
- `/commands/start`
- `/commands/stop`
- `/commands/restart`
- `/commands/redeploy`
- `/commands/reconcile`

Payload shape:
```json
{
  "requestId": "uuid",
  "actor": "user-or-system",
  "ts": 1739960000000
}
```

## Reported device state
- `/device/status/state: "stopped" | "starting" | "running" | "error"`
- `/device/status/message: string`
- `/device/status/lastError: string | null`
- `/device/status/updatedAt: number`

- `/device/runtime/mode: "docker" | "binary"`
- `/device/runtime/containerId: string | null`
- `/device/runtime/image: string | null`
- `/device/runtime/port: number | null`
- `/device/runtime/pid: number | null`

- `/device/health/alive: boolean` (from `GET /api/v1/alive`)
- `/device/health/latencyMs: number | null`
- `/device/health/version: string | null`
- `/device/health/lastCheckAt: number`

## Command acknowledgements
- `/device/acks/<requestId>/status: "ok" | "error"`
- `/device/acks/<requestId>/message: string`
- `/device/acks/<requestId>/ts: number`

---

## 6) Robot runtime behavior

Controller loop (every 5–10s):
1. Read desired config (`/config/*`).
2. Detect actual runtime state (container/process presence).
3. Reconcile if drift exists.
4. Poll ReductStore health (`/api/v1/alive`).
5. Publish `/device/*` state.

Command handling:
- Validate command + payload.
- Execute allowed action only.
- Emit ack under `/device/acks/<requestId>`.
- Update `/device/status/*` immediately.

---

## 7) Security requirements

1. Never publish raw API tokens in MQTT topics.
2. Store token only in local runtime secret source (env/file/agent secret bridge).
3. Allowlist executable operations; no arbitrary shell input.
4. Sanitize all config values before applying runtime changes.
5. Include actor/requestId in command ack for auditability.

---

## 8) Cloud component (v1 minimal)

- Subscribe to device status paths.
- Optionally expose fleet summary:
  - `/cloud/fleet/onlineCount`
  - `/cloud/fleet/errorCount`
  - `/cloud/fleet/lastSeen/<deviceId>`
- No mandatory command routing logic in v1 (can defer).

---

## 9) Web component (v1 minimal)

Device widget should show:
- running/stopped/error state
- last health probe result
- image/port currently applied
- actions: start/stop/restart/redeploy

Fleet widget optional in v1.

---

## 10) Acceptance criteria (v1)

1. Capability starts in Transitive dev flow.
2. `start` command brings up ReductStore and publishes `running`.
3. `stop` command stops ReductStore and publishes `stopped`.
4. Health poll updates `/device/health/alive` correctly.
5. No raw token leaks in capability data model.
6. Restart/redeploy commands produce deterministic acks.

---

## 11) Open decisions (to validate together)

1. Docker-only v1, or binary fallback also required now?
2. Token provisioning source: env file, portal-injected secret, or external vault?
3. Single-instance only, or support multiple named ReductStore instances per device?
4. Should cloud v1 support fleet command fan-out, or read-only summary only?
5. Minimum UI for v1: status-only vs status+controls.
