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

Transitive Configuration Management maintains `~/.transitive/config.json`, the file shared across every capability sandbox. This capability reads its own section, keyed by the package name `@reductstore/reductstore`. Configuration Management merges fleet, group, and robot values; restart the capability from the portal after a change.

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

`bridge.variant` selects the native executable. Valid values are `ros2-jazzy`, `ros2-humble`, `ros1`, and `iot`. `bridge.preset` generates the bridge TOML when `bridge.toml` is empty. Valid presets are `ros2`, `ros1`, `mqtt`, `http`, and `shell`. Set `bridge.toml` to a complete TOML document to use a managed custom configuration instead.

The Store receives its server, bucket, token, and replication settings as environment variables. The Bridge writes the rendered TOML to the local state directory before it starts.

## Portal

The device portal is operational only. It shows Store and Bridge process status, command errors, and captured logs. Start, Stop, and Restart control the native processes. Configure runtime settings exclusively through Transitive Configuration Management.
