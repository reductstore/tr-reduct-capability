# ReductStore

Records robot data locally with native ReductStore and ReductBridge processes. The capability manages their lifecycle and reports their status through the Transitive portal.

## Platform support

The capability supports Linux x64. Its `robot` postinstall downloads the native binaries straight from the ReductStore and ReductBridge GitHub release infrastructure, verifying each against the SHA-256 pinned in `native-dependencies.json`. The npm package never contains those binaries, and installation on an unsupported platform or architecture is skipped. Set `SKIP_NATIVE_BINARIES=1` to skip the download (CI and dev).

| Component    | Pinned upstream release | Native artifacts                                     |
| ------------ | ----------------------- | ---------------------------------------------------- |
| ReductStore  | `v1.21.2`               | `linux/x64`                                          |
| ReductBridge | `v0.5.0`                | ROS 2 Jazzy, ROS 2 Humble, ROS 1, IoT on `linux/x64` |

Bump the pinned release and its SHA-256 in `native-dependencies.json` to move to a new upstream version.

## Configuration

Configuration lives in `~/.transitive/config.json` on the robot, under this capability's package-name key `@reductstore/reductstore`. Edit it from the device portal (below), or write the file directly. Changes take effect on restart.

```json
{
  "@reductstore/reductstore": {
    "autoStart": true,
    "store": {
      "httpPort": 8383,
      "dataPath": "/home/robot/.tr-reduct-capability/reductstore-data",
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
}
```

`bridge.variant` selects the native executable. Valid values are `ros2-jazzy`, `ros2-humble`, `ros1`, and `iot`. `bridge.preset` generates the bridge TOML when `bridge.toml` is empty. Valid presets are `ros2`, `ros1`, `mqtt`, `http`, and `shell`. Set `bridge.toml` to a complete TOML document to override the preset for that robot.

The Store receives its server, bucket, token, and replication settings as environment variables. The Bridge writes the rendered TOML to the local state directory before it starts.

## Portal

The device portal shows Store and Bridge process status, errors, and logs, controls the native processes with Start / Stop / Restart, and edits this robot's configuration (store settings, bridge variant, preset, and TOML). Apply & Restart saves the edits to the config file and restarts.
