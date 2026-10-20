const { Buffer } = require("node:buffer");

function expiryFromToken(token) {
  if (typeof token !== "string") return null;
  const [, payload] = token.split(".");
  if (!payload) return null;
  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    const until = claims?.valid?.until;
    return Number.isFinite(until) ? until : null;
  } catch {
    return null;
  }
}

module.exports = { expiryFromToken };
