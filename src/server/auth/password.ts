import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with Node's built-in scrypt. Stored format:
 *   scrypt:<N>:<r>:<p>:<salt base64url>:<hash base64url>
 * Colons (not "$") so the value can go in .env files unescaped: Next.js expands
 * "$NAME" references there, which would corrupt a "$"-delimited hash.
 * Generate one with `npm run auth:hash-password`.
 */
const PREFIX = "scrypt";
const KEY_LENGTH = 64;
const DEFAULT_PARAMS = { N: 2 ** 15, r: 8, p: 1 };
// Bounds on stored parameters so a tampered hash can't request excessive work.
const MAX_N = 2 ** 20;

function scrypt(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, { ...options, maxmem: 256 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) throw new Error("Use a password of at least 12 characters.");
  const salt = randomBytes(16);
  const { N, r, p } = DEFAULT_PARAMS;
  const key = await scrypt(password, salt, KEY_LENGTH, { N, r, p });
  return [PREFIX, N, r, p, salt.toString("base64url"), key.toString("base64url")].join(":");
}

/** Constant-time check of a password against a stored hash. Malformed hashes never verify. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every(Number.isInteger) || N < 2 || N > MAX_N || (N & (N - 1)) !== 0 || r < 1 || r > 32 || p < 1 || p > 16) {
    return false;
  }
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  if (salt.length < 16 || expected.length !== KEY_LENGTH) return false;
  const actual = await scrypt(password, salt, KEY_LENGTH, { N, r, p });
  return timingSafeEqual(actual, expected);
}
