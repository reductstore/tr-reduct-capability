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

The ReductStore Pro binary requires glibc 2.38 or newer (Ubuntu 24.04+). On older systems the download is skipped and the capability reports that the binary is unavailable.

| Component       | Linux x64 | Linux arm64       |
| --------------- | --------- | ----------------- |
| ReductStore Pro | Supported | Supported         |
| ReductBridge    | Supported | Not yet available |

ReductBridge's upstream release currently publishes only Linux x64 binaries. On Linux arm64, leave the Bridge disabled and use the local ReductStore directly until an arm64 Bridge release is available.
