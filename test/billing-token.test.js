const test = require("node:test");
const assert = require("node:assert/strict");
const { Buffer } = require("node:buffer");

const { expiryFromToken } = require("../robot/lib/billing-token");

function token(claims) {
  return `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
}

test("reads the billing validity deadline without persisting the token", () => {
  assert.equal(
    expiryFromToken(token({ valid: { until: 1_800_000_000_000 } })),
    1_800_000_000_000,
  );
});

test("rejects malformed or incomplete billing token claims", () => {
  assert.equal(expiryFromToken("not-a-token"), null);
  assert.equal(expiryFromToken(token({})), null);
  assert.equal(expiryFromToken(token({ valid: { until: "tomorrow" } })), null);
});
