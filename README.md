# ReductStore

Store data on each robot and replicate it to a central ReductStore.

## What it does

- Runs ReductStore Pro locally on the robot.
- Optionally runs ReductBridge to record ROS 2, MQTT, HTTP, shell-command, and other IoT data.
- Replicates new records to another ReductStore when connectivity is available.
- Shows configuration, status, and logs in the Transitive portal.

Each robot keeps recording while disconnected. Replication catches up when it reconnects. The default FIFO bucket size limits disk use by removing the oldest records when it is full.

## Configure

Open the capability on a device page in the Transitive portal to configure:

- local data path, HTTP port, API token, and bucket quota;
- ReductBridge and its configuration;
- replication targets.

Query the local or central store with the [ReductStore API and SDKs](https://www.reduct.store/docs/api).

## Requirements

- A valid Transitive billing token is required to start ReductStore Pro.
- Linux x64 and arm64 are supported.
- ReductStore Pro requires glibc 2.38 or newer, such as Ubuntu 24.04.

Native binaries download automatically during installation. ReductStore Pro is pinned to `v1.21.5-0`; ReductBridge is pinned to `v0.5.7`. Bridge downloads use pinned SHA-256 checksums.

When ROS is not detected, ReductBridge starts disabled. Enable it from the device page when needed.

## Uninstalling

Stopping or uninstalling the capability stops ReductStore and ReductBridge.

The default data directory is inside the capability state directory. It survives restarts and reboots, but uninstalling the capability deletes it. Back up or replicate data you need, or set the data path to external storage.
