const fs = require("node:fs");
const path = require("node:path");
const jwt = require("jsonwebtoken");

const CLOCK_SKEW_MS = 2 * 60 * 1000;
const BILLING_PUBLIC_KEY = fs.readFileSync(
  path.join(__dirname, "..", "keys", "transitive-billing.pub"),
  "utf8",
);

function verifyBillingToken(
  token,
  {
    publicKey = BILLING_PUBLIC_KEY,
    deviceId,
    userId,
    capability,
    now = Date.now(),
  },
) {
  const claims = jwt.verify(token, publicKey, {
    algorithms: ["RS256"],
    ignoreExpiration: true,
    ignoreNotBefore: true,
  });
  const from = claims?.valid?.from;
  const until = claims?.valid?.until;
  if (!Number.isFinite(from) || !Number.isFinite(until)) {
    throw new Error("billing token has an invalid validity window");
  }
  if (from > now + CLOCK_SKEW_MS) {
    throw new Error("billing token is not yet valid");
  }
  if (until < now) {
    throw new Error("billing token has expired");
  }
  if (claims.deviceId !== deviceId) {
    throw new Error("billing token device does not match this robot");
  }
  if (claims.userId !== userId) {
    throw new Error("billing token user does not match this organization");
  }
  if (claims.capability !== capability) {
    throw new Error("billing token capability does not match this capability");
  }
  return until;
}

module.exports = { BILLING_PUBLIC_KEY, verifyBillingToken };
