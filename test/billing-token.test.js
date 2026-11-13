const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

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
  return jwt.sign(claims, key, { algorithm: "RS256", noTimestamp: true });
}

const {
  verifyBillingToken,
  persistToken,
  loadPersistedToken,
  deletePersistedToken,
} = require("../robot/lib/billing-token");

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

test("persistToken writes the token to disk at mode 0600", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-bt-"));
  const file = path.join(dir, "billing-token");
  const token = "a.b.c";

  persistToken(token, file);

  assert.equal(fs.readFileSync(file, "utf8"), token);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test("loadPersistedToken reads back a persisted token", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-bt-"));
  const file = path.join(dir, "billing-token");
  fs.writeFileSync(file, "x.y.z", { encoding: "utf8", mode: 0o600 });

  assert.equal(loadPersistedToken(file), "x.y.z");
});

test("loadPersistedToken returns null when no file exists", () => {
  const file = path.join(os.tmpdir(), `tr-bt-missing-${Date.now()}`);
  assert.equal(loadPersistedToken(file), null);
});

test("deletePersistedToken removes the file silently", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-bt-"));
  const file = path.join(dir, "billing-token");
  fs.writeFileSync(file, "x.y.z", "utf8");

  deletePersistedToken(file);

  assert.equal(fs.existsSync(file), false);
  assert.doesNotThrow(() => deletePersistedToken(file));
});
