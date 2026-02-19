# tr-reduct-capability

Transitive Robotics package to deploy and manage ReductStore.

## What is implemented (v1)

- Robot capability with ReductStore lifecycle commands:
  - start
  - stop
  - restart
- Device status + health publishing (`/device/status/*`, `/device/health/*`)
- Command ACKs (`/device/acks/<requestId>/*`)
- Minimal cloud fleet summary (`runningCount`, `errorCount`)
- Minimal device/fleet web components
- Hardened command dispatch/queue behavior with race-focused tests

## Project structure

- `robot/` robot runtime and command handling
- `cloud/` minimal fleet summary logic
- `web/` minimal UI components
- `docs/CAPABILITY_SPEC.md` capability scope
- `test/` unit + hardening tests

## Local dev

```bash
npm --prefix robot install
npm --prefix cloud install
npm test
```

Run robot locally:

```bash
npm run dev:robot
```

Run cloud locally:

```bash
npm run dev:cloud
```

## Integration smoke (runtime lifecycle)

Example real-runtime smoke flow:

1. Start ReductStore via runtime adapter
2. Verify `status` is `running`
3. Restart and verify still `running`
4. Stop and verify `stopped`

In this environment, Docker access may require running commands under the docker group context (`sg docker -c '...'`).

## Current status

Phase 5 integration readiness is complete for this iteration:

- automated tests passing
- command/race hardening reviewed
- integration smoke checks passing
