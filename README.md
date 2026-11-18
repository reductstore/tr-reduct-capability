# ReductStore

Record data on each robot and replicate it to a central [ReductStore](https://www.reduct.store/).

## What it does

- Runs **ReductStore Pro** on the robot with a local time-series bucket.
- Optionally runs **ReductBridge** to record data from ROS 1 topics, ROS 2 topics, MQTT brokers, HTTP endpoints, shell commands, and host metrics.
- **Replicates** new records to a remote ReductStore. Replication is append-only and resumes after disconnects.
- Buckets use a configurable quota (FIFO, HARD, or NONE). FIFO drops the oldest records when full, so recording never stops and disk use stays bounded.

Each robot records independently. When offline, data stays local. When connectivity returns, replication catches up.

## Query

Access any robot's store or the central store through the [ReductStore HTTP API and SDKs](https://www.reduct.store/docs/getting-started) (Python, JavaScript, Go, Rust, C++) using the configured endpoint and API token.

ReductStore Pro includes the [ReductSelect](https://www.reduct.store/docs/extensions/official/select-ext) extension: run SQL queries over stored CSV, JSON, Parquet, and Protobuf records using Apache DataFusion, directly on the database.

## Configure

Open the capability on a device in the Transitive portal to set:

- data path, HTTP port, API token, bucket name, and quota;
- ReductBridge variant and its TOML configuration;
- replication targets and filters.

## Requirements

- A valid Transitive billing token (the platform issues it automatically for paid subscriptions).
- Linux x64 or arm64 with glibc 2.39+ (Ubuntu 24.04+).

Binaries download during installation. Pinned versions: ReductStore Pro `v1.21.5-0`, ReductBridge `v0.5.7`. Bridge archives are verified with SHA-256 checksums.

When ROS is not detected, ReductBridge starts disabled. Enable it from the device page.

## Uninstall

Stopping or uninstalling the capability stops both processes. The default data directory is inside the capability state directory - it survives restarts but is deleted on uninstall. Set the data path to external storage or replicate data before uninstalling.
