const fs = require("node:fs");
const path = require("node:path");
const jwt = require("jsonwebtoken");

const { BILLING_TOKEN_PATH } = require("./config");

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

function persistToken(token, filePath = BILLING_TOKEN_PATH) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, token, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, filePath);
  fs.chmodSync(filePath, 0o600);
}

function loadPersistedToken(filePath = BILLING_TOKEN_PATH) {
  try {
    return fs.readFileSync(filePath, "utf8").trim() || null;
  } catch {
    return null;
  }
}

function deletePersistedToken(filePath = BILLING_TOKEN_PATH) {
  try {
    fs.rmSync(filePath, { force: true });
  } catch {
    // rmSync with force:true only throws on genuine OS errors; silently ignore
  }
}

module.exports = {
  BILLING_PUBLIC_KEY,
  verifyBillingToken,
  persistToken,
  loadPersistedToken,
  deletePersistedToken,
};
