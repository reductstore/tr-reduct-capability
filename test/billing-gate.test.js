const test = require("node:test");
const assert = require("node:assert/strict");

const { createBillingGate } = require("../robot/lib/billing-gate");

function fixture() {
  const events = [];
  const timers = [];
  let now = 1_800_000_000_000;
  const gate = createBillingGate({
    verify(token) {
      if (token === "invalid") throw new Error("invalid billing token");
      return token === "first" ? now + 10_000 : now + 20_000;
    },
    now: () => now,
    setTimeout(fn, delay) {
      const timer = { fn, delay, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeout(timer) {
      timer.cleared = true;
    },
    onEntitled() {
      events.push("entitled");
    },
    onDenied(reason) {
      events.push(`denied:${reason}`);
    },
  });

  return { events, gate, now: () => now, timers };
}

test("billing token rotation refreshes expiry without restarting entitled work", () => {
  const { events, gate, timers } = fixture();

  assert.deepEqual(gate.update("first"), {
    valid: true,
    expiresAt: 1_800_000_010_000,
  });
  assert.deepEqual(gate.update("replacement"), {
    valid: true,
    expiresAt: 1_800_000_020_000,
  });

  assert.deepEqual(events, ["entitled"]);
  assert.equal(timers[0].cleared, true);
  assert.equal(timers[1].delay, 20_000);
});

test("billing token expiry revokes entitlement until a valid replacement arrives", () => {
  const { events, gate, timers } = fixture();

  gate.update("first");
  timers[0].fn();
  gate.update("replacement");

  assert.deepEqual(events, ["entitled", "denied:expired", "entitled"]);
});

test("invalid billing tokens revoke an existing entitlement", () => {
  const { events, gate } = fixture();

  gate.update("first");
  assert.deepEqual(gate.update("invalid"), {
    valid: false,
    reason: "invalid billing token",
  });

  assert.deepEqual(events, ["entitled", "denied:invalid billing token"]);
});
