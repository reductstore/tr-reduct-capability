# tr-reduct-capability

Transitive Robotics capability that runs [ReductStore](https://www.reduct.store/) on a robot and ingests ROS 1 / ROS 2 topics into it via [ReductBridge](https://github.com/reductstore/reduct-bridge).

## Features

- Manages a ReductStore Docker container (start / stop / restart)
- Manages a ReductBridge host process for ROS topic ingestion
- Generates ReductBridge TOML config from runtime settings
- Auto-starts on boot with configurable boot policy
- Persists config to disk across restarts
- Process watchdog with exponential backoff recovery
- Web UI with settings editor for store, bridge, and ROS topics
- Fleet summary with per-component status breakdown
- Standalone dev mode with embedded MQTT broker

## Prerequisites

- Node.js 20+
- Docker
- `reduct-bridge` binary on the host (or set `bridge.command` to the binary path)
- ROS 1 and/or ROS 2 installed locally for the inputs you want to use
- Transitive agent installed (not needed in standalone mode)

## Quick start

```bash
npm --prefix robot install
npm --prefix cloud install
npm test
```

### Standalone dev mode (no Transitive agent needed)

```bash
npm run dev
```

Starts an embedded MQTT broker on port 1883 and an HTTP status endpoint on port 9080. ReductStore auto-starts via Docker.

### With Transitive agent

```bash
npm run dev:robot    # robot part
npm run dev:cloud    # cloud part
```

## Project structure

```
robot/          Robot runtime: store + bridge lifecycle, config, watchdog
cloud/          Cloud part: fleet summary aggregation
web/            Web components: device settings editor, fleet summary
test/           Unit tests
test/integration/  Integration tests (config persistence, Docker lifecycle, watchdog)
docs/           Capability spec
```

## Runtime config

Config is published and editable via the web UI, or by writing to MQTT paths:

| Path | Description |
|---|---|
| `/config/runtime/store` | ReductStore container settings (image, port, auth) |
| `/config/runtime/bridge` | ReductBridge process settings (command, bucket, batch tuning) |
| `/config/runtime/ros1` | ROS 1 input (enabled, URI, topics) |
| `/config/runtime/ros2` | ROS 2 input (enabled, domain ID, schema paths, topics) |
| `/config/runtime/boot` | Boot policy (auto-start store, auto-start bridge) |

Config is persisted to `~/.tr-reduct-capability/config.json` and reapplied on restart.

### Example: add a ROS 2 topic

```json
{
  "ros2": {
    "enabled": true,
    "domainId": 0,
    "topics": [{ "name": "/scan" }, { "name": "/camera/image_raw" }]
  }
}
```

## Commands

Send via MQTT or the web UI:

| Command | Effect |
|---|---|
| `start` | Start ReductStore, then start ReductBridge if ROS inputs are configured |
| `stop` | Stop bridge, then stop store |
| `restart` | Stop bridge → restart store → start bridge |

## Device status

Published to `/device/status/state`:

| State | Meaning |
|---|---|
| `running` | Store is running; bridge is running or not needed |
| `error` | Store failed, or bridge is configured but not running |
| `stopped` | Store is stopped |

## Tests

```bash
npm test                    # unit tests (26 tests)
npm run test:integration    # integration tests (16 tests, needs Docker)
```
