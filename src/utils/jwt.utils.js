// utils/jwt.utils.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is not set. Set JWT_SECRET before starting the server."
  );
}

export function signJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyJwt(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Return cookie maxAge (ms) derived from JWT_EXPIRES_IN string like '7d', '24h', '3600s'
export function getJwtExpiryMs() {
  const v = JWT_EXPIRES_IN;
  const match = /^([0-9]+)\s*(d|h|m|s)?$/i.exec(v);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days
  const num = parseInt(match[1], 10);
  const unit = (match[2] || "d").toLowerCase();
  switch (unit) {
    case "d":
      return num * 24 * 60 * 60 * 1000;
    case "h":
      return num * 60 * 60 * 1000;
    case "m":
      return num * 60 * 1000;
    case "s":
      return num * 1000;
    default:
      return num * 24 * 60 * 60 * 1000;
  }
}
