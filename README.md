# ReductStore

Records your robot's data on the robot itself and syncs it to a central
[ReductStore](https://www.reduct.store/). It runs two Docker containers, managed
from the portal:

- **ReductStore**: a time-series object store that keeps data on the robot with
  per-bucket size limits.
- **ReductBridge**: ingests data from the robot (ROS 2, ROS 1, or IoT sources
  such as MQTT, HTTP, and shell commands) into the store.

## Features

- Start, stop, and restart both containers from the portal.
- Configure the store: image, HTTP port, API token, and bucket (name, quota
  type, size).
- Replicate data to a central ReductStore.
- Pick a data source and edit its bridge configuration in the portal.
- Fleet view: per-organization running / stopped / error counts, and how many
  stores and bridges are up.

## Prerequisites

- Docker installed on the robot.
- The data source you want to record, reachable from the robot: a running ROS
  graph, an MQTT broker, or an HTTP endpoint. ROS ingestion uses host
  networking.

## Configuration

Everything is configured from the device view in the portal.

**Store**: set the image, HTTP port, API token, and bucket (name, quota type,
size), and define replication tasks to sync data to a central ReductStore.

**Bridge**: disabled by default. Pick an image for your data source and edit
its TOML configuration. See the
[ReductBridge docs](https://www.reduct.store/docs/reduct-bridge).
