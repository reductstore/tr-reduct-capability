# ReductStore

Records robot data locally with native ReductStore and ReductBridge processes. The capability manages their lifecycle and reports their status through the Transitive portal.

## Platform support

The capability supports Linux x64. Its `robot` postinstall downloads the current ReductStore Pro ZIP from the Transitive endpoint and the ReductBridge binaries from their GitHub release. The npm package never contains those binaries, and installation on an unsupported platform or architecture is skipped. Set `SKIP_NATIVE_BINARIES=1` to skip the download (CI and dev).

| Component       | Source                            | Native artifacts                                     |
| --------------- | --------------------------------- | ---------------------------------------------------- |
| ReductStore Pro | Transitive `latest` endpoint      | `linux/x64`                                          |
| ReductBridge    | GitHub `v0.5.0`, SHA-256 verified | ROS 2 Jazzy, ROS 2 Humble, ROS 1, IoT on `linux/x64` |

The Pro download is authorized and integrity-protected by HTTPS and a short-lived Azure Blob SAS URL. Bridge artifact versions and SHA-256 values remain pinned in `native-dependencies.json`.

## Configuration

Configuration belongs to this capability and persists at `/home/transitive/config.json` inside its sandbox. On the robot, Transitive maps that path to `~/.transitive/packages/@reductstore-tr/reductstore/config.json`. It is intentionally separate from Transitive Configuration Management.

The device portal sends configuration changes over MQTTSync. Apply & Restart atomically saves the complete configuration to this private file and restarts the native processes.

```json
{
  "autoStart": true,
  "store": {
    "httpPort": 8383,
    "dataPath": "/home/transitive/state/reductstore-data",
    "apiToken": "replace-with-a-secret",
    "bucket": {
      "name": "robot-data",
      "quotaType": "FIFO",
      "quotaSize": "1GB"
    },
    "replications": [],
    "env": []
  },
  "bridge": {
    "enabled": true,
    "variant": "ros2-jazzy",
    "preset": "ros2",
    "rosDomainId": 0,
    "env": [],
    "toml": ""
  }
}
```

`bridge.variant` selects the native executable. Valid values are `ros2-jazzy`, `ros2-humble`, `ros1`, and `iot`. `bridge.preset` generates the bridge TOML when `bridge.toml` is empty. Valid presets are `ros2`, `ros1`, `mqtt`, `http`, and `shell`. Set `bridge.toml` to a complete TOML document to override the preset for that robot.

The Store receives its server, bucket, token, and replication settings as environment variables. The Bridge writes the rendered TOML to the capability state directory before it starts.

## Transitive billing

The robot subscribes to Transitive's `/billing/token` data path. It verifies each token's RS256 signature, robot, organization, capability, and validity window, and persists the current verified token to its private state directory (`0600`). The token is passed to ReductStore Pro as `RS_TRANSITIVE_BILLING_TOKEN` whenever Store launches, so Pro validates entitlement at startup. A refreshed valid token updates the expiry timer and the persisted token without restarting a running Store. When the token expires or an invalid one arrives, the capability stops ReductBridge and ReductStore, clears the persisted token, and exits so the agent restarts it. On restart it loads the persisted token; if still valid it starts Store (when `autoStart` is enabled), otherwise it waits for a new token.
