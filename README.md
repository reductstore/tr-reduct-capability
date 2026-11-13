# ReductStore

Record robot data on each robot and replicate it to a central store, built on [ReductStore](https://www.reduct.store/) Pro. Every robot keeps a local time-series store that survives intermittent connectivity, and new records replicate to the cloud or a central server for the whole fleet.

![ReductStore capability data flow: ReductBridge feeds a local FIFO ReductStore Pro bucket on each robot, which replicates new records to a central ReductStore queried through the API and SDK](docs/architecture.svg)

## What it does

- Runs a local **ReductStore Pro** instance on the robot: a time-series store with configurable buckets, a **FIFO quota**, data directory, HTTP port, and API token. When a bucket reaches its quota, the oldest records are dropped, so recording never blocks and the disk never fills.
- Optionally runs **ReductBridge** to record ROS 2, MQTT, HTTP, shell-command, and other IoT data into the store.
- **Replicates** new records to a remote or central ReductStore. Replication is append-only and resumes automatically after a disconnect.
- Reports store, Bridge, and replication status in the Transitive portal.

## Why it is robust for a fleet

Each robot owns its data. Recording continues whether or not the robot is online, and the FIFO quota bounds disk use instead of failing when storage is full. When connectivity returns, replication catches up on its own. Across a fleet, every robot records independently and streams to one central store, so a single robot or link outage never loses the data the other robots keep producing. The quota is the one tradeoff: if a robot stays offline longer than its bucket holds, the oldest unreplicated records are evicted to keep the newest.

## Query and transform

Query a robot's store directly, or the central store, through the [ReductStore API and SDKs](https://www.reduct.store/docs/api) using the configured HTTP endpoint and API token.

ReductStore **Pro** adds a Rust/WASM query engine: turn raw ROS messages into structured, columnar records, filter by label or content, and fuse multiple entries at query time, so you read tables instead of parsing blobs.

## Configure

Set the store, Bridge, and replication tasks from the capability's device page in the Transitive portal.

## Platform support

Native binaries download automatically when the capability is installed. Versions are pinned: ReductStore Pro `v1.21.5-0` and ReductBridge `v0.5.7`.

The ReductStore Pro binary requires glibc 2.38 or newer (Ubuntu 24.04+).

| Component       | Linux x64 | Linux arm64 |
| --------------- | --------- | ----------- |
| ReductStore Pro | Supported | Supported   |
| ReductBridge    | Supported | Supported   |

Bridge downloads are verified against pinned SHA-256 checksums. On systems whose glibc is older than ReductStore Pro requires, the download is skipped, the capability still installs, and it reports that the binary is unavailable.

On fresh installations where ROS is not detected, ReductBridge remains disabled until an operator enables it.

## Uninstalling

Stopping or uninstalling the capability stops ReductStore and ReductBridge.

Capability state, including runtime PID files and ReductStore data, is stored in the installed package directory, so it survives capability restarts and robot reboots. Uninstalling the capability deletes that directory and the state it holds. Back up or replicate anything you need before uninstalling, or set the store data path to external storage.
