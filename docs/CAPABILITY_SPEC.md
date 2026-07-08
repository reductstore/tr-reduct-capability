# ReductStore Capability Spec

## What it does

Runs two Docker containers on a robot and lets an operator control and configure
them from the Transitive portal:

- **ReductStore**, configured via provisioning env vars.
- **ReductBridge**, configured via an operator-authored TOML file.

Deliberately minimal first version. No watchdog, no command queue, no per-topic
config builder — robustness comes from Docker's `--restart unless-stopped`.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Web UI     │────▶│  Cloud       │◀────│  Robot       │
│  settings   │     │  fleet agg   │     │  main.js     │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                │ docker run (--restart unless-stopped)
                                         ┌──────┴──────┐
                                         ▼             ▼
                                   ReductStore    ReductBridge
                                   (provisioning) (config.toml)
```

## Robot part (`robot/`)

- `lib/config.js` — defaults + load/save to `~/.tr-reduct-capability/config.json`
  (deep-merge, atomic write, falls back to defaults on a corrupt file).
- `lib/store.js` — ReductStore container (`reduct/store:latest`). `buildRunArgs`
  emits provisioning env (`RS_API_TOKEN`, `RS_BUCKET_1_*`) and runs the container
  as the host `uid:gid` (v1.19+ images are non-root, so a bind-mounted data dir
  owned by another user is otherwise unwritable). `waitUntilAlive` polls
  `HEAD /api/v1/alive`.
- `lib/bridge.js` — ReductBridge container. Writes the config TOML to
  `~/.tr-reduct-capability/bridge.toml`, mounts it read-only, host networking +
  `--ipc=host` (so ROS 2 Fast DDS shared-memory transport reaches host nodes),
  `ROS_DOMAIN_ID`, and `HOME=/tmp` (the image runs as a non-root user whose home
  is `/nonexistent`; ROS 2 aborts if it can't create `~/.ros/log`). Runs
  `reduct-bridge <config>`. Surfaces container logs if it fails to start.
- `main.js` — MQTT wiring; serializes container ops on one promise chain;
  publishes status every 5s; auto-starts on boot. Containers are left running on
  SIGTERM (restart policy keeps them up).

Commands arrive as one JSON leaf at `/commands/request`; config as one JSON leaf
at `/config/json`.

## Cloud part (`cloud/`)

Aggregates a fleet summary (`total`, `running`, `stopped`, `error`,
`storeRunning`, `bridgeRunning`) from each device's `/device/state` etc.;
republishes on change and every 10s.

## Web part (`web/`)

- `reductstore-device.jsx` — status line + Start/Stop/Restart, a store
  provisioning form (image, port, data path, token, bucket, quota), and a bridge
  section (enabled, image, ROS_DOMAIN_ID, extra mounts, and a `config.toml`
  textarea). Save / Save & Restart writes the whole config to `/config/json`.
- `reductstore-fleet.jsx` — the fleet summary table.

## Standalone dev mode

`STANDALONE=true node main.js` (or `npm run dev`) starts an embedded MQTT broker
— no Transitive agent needed for local testing.

## Web build

Web components are bundled by esbuild via `transitiveDev web` (from
`@transitive-sdk/utils-caps`), which injects `TR_PKG_NAME` / `TR_PKG_VERSION` /
`TR_PKG_VERSION_NS` and emits `dist/reductstore-{device,fleet}.js`. Runs on
`npm install` (the `prepare` script) and on publish.

## Tests

Unit tests (`npm test`): config load/save/merge, store provisioning args, bridge
TOML/run args, cloud fleet summary.

Scope for v1: the bridge default is the ROS 2 build
(`reduct/bridge:main-ros2-jazzy`, which supports ROS 2 / Shell / Metrics
inputs). The `main-` tag carries the nounset entrypoint fix; switch to
`latest-ros2-jazzy` once that fix reaches the stable branch. ROS 1 is out of
scope for now.

## Remaining work

1. End-to-end validation on a real robot with ROS + the ROS 2 bridge build.
2. Optionally keep the store `apiToken` / `bucket` and the bridge TOML remote in
   sync automatically (currently the operator keeps them matching).
