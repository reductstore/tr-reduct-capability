# tr-reduct-capability

Transitive Robotics package to deploy and manage ReductStore.

## What is implemented (v1)

- Robot capability with ReductStore lifecycle commands:
  - start
  - stop
  - restart
- Device status + health publishing
- Minimal cloud summary capability
- Minimal device/fleet web components
- Basic runtime unit tests

## Project structure

- `robot/` robot runtime and command handling
- `cloud/` minimal fleet summary logic
- `web/` minimal UI components
- `docs/CAPABILITY_SPEC.md` capability scope
- `test/` basic tests

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
