const test = require("node:test");
const assert = require("node:assert/strict");

const { generateKeyPairSync } = require("node:crypto");
const jwt = require("jsonwebtoken");

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const context = {
  deviceId: "robot-1",
  userId: "organization-1",
  capability: "@reductstore-tr/reductstore",
  now: 1_800_000_000_000,
};

function signedToken(claims, key = privateKey) {
  return jwt.sign(claims, key, {
    algorithm: "RS256",
    noTimestamp: true,
  });
}

const { verifyBillingToken } = require("../robot/lib/billing-token");

test("verifies a signed billing token for the current robot and capability", () => {
  const expiresAt = verifyBillingToken(
    signedToken({
      valid: { from: context.now - 1_000, until: context.now + 60_000 },
      deviceId: context.deviceId,
      userId: context.userId,
      capability: context.capability,
    }),
    { ...context, publicKey },
  );

  assert.equal(expiresAt, context.now + 60_000);
});

test("rejects a billing token for another capability", () => {
  assert.throws(
    () =>
      verifyBillingToken(
        signedToken({
          valid: { from: context.now - 1_000, until: context.now + 60_000 },
          deviceId: context.deviceId,
          userId: context.userId,
          capability: "@other/capability",
        }),
        { ...context, publicKey },
      ),
    /capability/i,
  );
});
