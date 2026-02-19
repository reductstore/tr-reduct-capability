# ReductStore Capability Spec (Simple v1)

## Goal

Build a **small Transitive Robotics package** that can manage a local ReductStore instance on a robot/device.

That means:
- start ReductStore
- stop ReductStore
- restart ReductStore
- show if it is healthy/alive

## In scope (now)

1. **Robot part (main part)**
   - Control ReductStore lifecycle
   - Report state (`running`, `stopped`, `error`)
   - Report simple health (`/api/v1/alive`)

2. **Minimal cloud part**
   - Read device status
   - Show a basic fleet summary (very small)

3. **Minimal UI part**
   - Device status
   - Start / Stop / Restart buttons

4. **Basic tests**
   - Command handling works
   - State updates are correct

## Out of scope (later)

- Advanced orchestration
- Backup/restore
- Full dashboard features
- Multi-instance management

## Next steps after this package works

1. Add a **collector** to this same package (definition pending).
2. Configure collector to gather data from multiple sources and store it in ReductStore.

(Collector work is **not part of this v1 scope**.)

## Definition of done for v1

- Package runs in Transitive as a capability
- We can start/stop/restart ReductStore from capability flow
- Health/state is visible
- Minimal cloud + UI are present
- Tests pass
