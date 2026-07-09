# tr-reduct-capability

Transitive Robotics capability that runs [ReductStore](https://www.reduct.store/)
and [ReductBridge](https://www.reduct.store/docs/reduct-bridge) as Docker
containers on a robot. ReductStore is configured through
[provisioning](https://www.reduct.store/docs/configuration/provisioning)
environment variables; the bridge is configured with a TOML file you author.

This is a deliberately small first version: start/stop/restart two containers,
edit their config from the portal, done. Robustness comes from Docker's
`--restart unless-stopped` policy — no watchdog in the capability itself.

It follows the standard Transitive SDK layout (`npm init @transitive-sdk@latest`)
and publishes to the local registry as `@local/reductstore`.

## Prerequisites

- Node.js 20+
- Docker
- A provisioning-capable ReductStore image — default `reduct/store:latest`
  (1.19+). Note the old `reductstore/reductstore` Docker Hub tags can be stale
  (e.g. 1.3.2) and silently ignore the `RS_BUCKET_*` variables. Since v1.19 the
  image runs as a non-root user; the capability handles the bind-mount
  permissions by running the container as its own uid:gid.
- For ROS ingestion: ROS running on the host (the bridge uses host networking).
- Transitive agent installed (not needed in standalone dev mode).

## What it does

- **ReductStore** — runs `reduct/store:latest`, publishing port 8383
  and persisting `/data`. Auth and the initial bucket are set via provisioning
  env vars: `RS_API_TOKEN`, `RS_BUCKET_1_NAME`, and optional
  `RS_BUCKET_1_QUOTA_TYPE` / `RS_BUCKET_1_QUOTA_SIZE`. Replication tasks are
  reconciled through the store API after start (create, update, and delete to
  match config), and any extra `RS_*` variable can be added as a free form env
  var.
- **ReductBridge** — runs `reduct/bridge:<build>` (default `main-ros2-jazzy`,
  which carries the nounset entrypoint fix; move to `latest-ros2-jazzy` once
  that fix reaches the stable branch) with `--network host`, mounting your
  `config.toml` read-only at `/etc/reduct-bridge/config.toml`. Add as many
  inputs as you like in the TOML.

## Quick start

```bash
npm install          # installs robot deps and builds the web components (dist/)
npm test
```

### Standalone dev mode (no Transitive agent needed)

```bash
npm run dev          # embedded MQTT :1883 + HTTP :9080; auto-starts the containers
```

### Full dev loop (robot + web + cloud, with the agent)

```bash
npm run dev:start    # transitiveDev tmux: robot + web build + cloud container
npx transitiveDev web   # web components only (rebuild web/*.jsx → dist/)
```

## Configuration

Edit everything from the device page in the portal (a small settings form), or
publish the whole config as one JSON string to `/config/json`. It is persisted
to `~/.tr-reduct-capability/config.json` and reapplied on restart.

```jsonc
{
  "autoStart": true,
  "store": {
    "image": "reduct/store:latest",
    "httpPort": 8383,
    "dataPath": "~/.tr-reduct-capability/reductstore-data",
    "apiToken": "transitive-local-token",
    "bucket": { "name": "robot-data", "quotaType": "FIFO", "quotaSize": "1GB" },
    "replications": [
      { "name": "to-cloud", "srcBucket": "robot-data", "dstBucket": "fleet",
        "dstHost": "https://play.reduct.store", "dstToken": "…",
        "entries": "", "when": "" }
    ],
    "env": [ { "key": "RS_LOG_LEVEL", "value": "INFO" } ]
  },
  "bridge": {
    "enabled": false,
    "image": "reduct/bridge:main-ros2-jazzy",
    "rosDomainId": 0,
    "mounts": [],           // extra host dirs to mount ro (e.g. ROS 2 schemas)
    "toml": "…bridge config.toml…"
  }
}
```

The bridge `toml` is written verbatim to disk and mounted into the container, so
it supports any inputs ReductBridge understands (ROS 1/2, MQTT, HTTP, …). Keep
its `[[remotes.reduct]]` `token_api` / `bucket` in sync with the store settings.

## Commands

Send `start` / `stop` / `restart` from the UI, or publish
`{"action":"start","requestId":"…"}` to `/commands/request`.

| Command | Effect |
|---|---|
| `start` | Start ReductStore, wait until it is alive, then start the bridge (if enabled) |
| `stop` | Stop bridge, then stop store |
| `restart` | Stop bridge → restart store → start bridge |

## Device status

Published under `/device`: `state` (`running` / `stopped` / `error`),
`message`, `store/{running,alive,image}`, `bridge/{running,enabled,image}`,
and `config/json` (current config, for the UI to seed from).

## Project structure

```
robot/lib/config.js   Config defaults, load/save (disk), deep-merge
robot/lib/store.js    ReductStore container: provisioning env, start/stop/status
robot/lib/bridge.js   ReductBridge container: TOML file, start/stop/status
robot/main.js         MQTT wiring, command handling, status publishing
cloud/                Fleet summary aggregation
web/                  Device settings UI + fleet summary
test/                 Unit tests
```

## Tests

```bash
npm test
```
