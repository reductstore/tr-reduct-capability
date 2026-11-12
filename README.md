# ReductStore

Save robot data locally with [ReductStore](https://www.reduct.store/). Configure a store on each robot, record data into it, replicate selected data to another store, and query it through the standard ReductStore API.

## What it does

- Runs a local ReductStore Pro instance with a configurable bucket, quota, data directory, HTTP port, and API token.
- Optionally runs ReductBridge to record ROS, MQTT, HTTP, shell-command, and IoT data.
- Replicates new records to a remote or cloud ReductStore when the robot has connectivity.
- Shows store, Bridge, and replication status in the Transitive portal.

Configure the store, Bridge, and replication tasks from the capability's device page in the Transitive portal. Use the configured HTTP endpoint and API token to query stored data with the [ReductStore API and SDKs](https://www.reduct.store/docs/api).

## Platform support

Native binaries download automatically when the capability is installed.

The ReductStore Pro binary requires glibc 2.38 or newer (Ubuntu 24.04+).

| Component       | Linux x64 | Linux arm64 |
| --------------- | --------- | ----------- |
| ReductStore Pro | Supported | Supported   |
| ReductBridge    | Supported | Supported   |

Downloaded binaries are verified against pinned SHA-256 checksums. On systems whose glibc is older than ReductStore Pro requires, the download is skipped, the capability still installs, and it reports that the binary is unavailable.

## Uninstalling

Stopping or uninstalling the capability stops ReductStore and ReductBridge.

By default ReductStore writes its data inside the capability's state directory. Uninstalling the capability can delete that directory and the data it holds. Back up or replicate anything you need before uninstalling, or set the store data path to a location outside the capability's state directory.
