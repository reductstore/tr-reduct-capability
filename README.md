# tr-reduct-capability

Transitive Robotics capability that runs [ReductStore](https://www.reduct.store/)
and [ReductBridge](https://www.reduct.store/docs/reduct-bridge) as Docker
containers on a robot. ReductStore is configured through
[provisioning](https://www.reduct.store/docs/configuration/provisioning)
environment variables; the bridge is configured with a TOML file you author.

## Prerequisites

- Node.js 20+
- Docker
- A provisioning-capable ReductStore image (default `reduct/store:latest`)
- For ROS ingestion: ROS running on the host (the bridge uses host networking).
- Transitive agent installed.
