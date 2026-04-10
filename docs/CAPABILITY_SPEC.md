# ReductStore Capability Spec

## What it does

Transitive Robotics capability that manages a local ReductStore instance on a robot and ingests ROS 1 / ROS 2 topics into it via ReductBridge.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Web UI     │────▶│  Cloud       │────▶│  Robot       │
│  settings   │     │  fleet agg   │     │  runtime     │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                │
                                    ┌───────────┼───────────┐
                                    ▼           ▼           ▼
                              ReductStore   ReductBridge  Watchdog
                              (Docker)      (host proc)   (recovery)
```

## Robot part

- Start / stop / restart ReductStore (Docker container) and ReductBridge (host process)
- Generate ReductBridge TOML from runtime config (ROS 1 + ROS 2 inputs, remote, pipeline)
- Publish device state, component status, and health to MQTT data tree
- Persist config to `~/.tr-reduct-capability/config.json`
- Auto-start on boot (configurable via `boot.autoStartStore` / `boot.autoStartBridge`)
- Process watchdog: restarts crashed components with exponential backoff
- Graceful shutdown on SIGTERM / SIGINT

## Cloud part

- Aggregate fleet summary with per-component breakdown:
  - Store: running / stopped / error
  - Bridge: running / stopped / error / disabled
  - Ingestion: configured / not configured
- Publish on state change and every 10s

## Web part

- **Status tab**: overall state, health, component status, start/stop/restart buttons
- **Store tab**: image, container name, port, data path, auth settings
- **Bridge tab**: command, bucket, prefix, batch tuning, advanced paths
- **Topics tab**: ROS 1 and ROS 2 input config with dynamic topic management
- **Boot tab**: auto-start toggles
- Save / Save & Restart flow with config patching via MQTT

## Standalone dev mode

`STANDALONE=true node main.js` (or `npm run dev`) starts an embedded MQTT broker — no Transitive agent needed for local testing.

## Tests

- Unit tests: command handling, config validation, queue/dispatcher, bridge config generation, fleet summary
- Integration tests: config persistence round-trip, Docker lifecycle, watchdog behavior

## Remaining work

1. End-to-end validation on a real robot with ROS + Docker + reduct-bridge
2. Evaluate containerizing ReductBridge (cleaner than host binary, but ROS access from Docker is complex)
3. Replace PID-file process management with supervised runtime if needed
