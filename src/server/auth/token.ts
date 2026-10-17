import { createHmac, timingSafeEqual } from "node:crypto";

export type Role = "editor" | "viewer";

export interface Session {
  role: Role;
  /** Who signed in: the editor username, or "demo" for the read-only demo. */
  subject: string;
  /** Expiry, seconds since epoch. */
  exp: number;
}

export const SESSION_TTL_SECONDS = 8 * 60 * 60;

function sign(data: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

/** Stateless signed token: base64url(JSON payload) + "." + base64url(HMAC-SHA256). */
export function createSessionToken(
  role: Role,
  subject: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const payload: Session & { v: 1 } = { v: 1, role, subject, exp: nowSeconds + SESSION_TTL_SECONDS };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, secret).toString("base64url")}`;
}

/** The session in a token, or null if it is malformed, tampered with or expired. */
export function readSessionToken(
  token: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Session | null {
  if (!token || token.length > 1024) return null;
  const [data, signature, extra] = token.split(".");
  if (!data || !signature || extra !== undefined) return null;

  const expected = sign(data, secret);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Record<string, unknown>;
    const { v, role, subject, exp } = payload;
    if (v !== 1 || (role !== "editor" && role !== "viewer")) return null;
    if (typeof subject !== "string" || typeof exp !== "number" || exp <= nowSeconds) return null;
    return { role, subject, exp };
  } catch {
    return null;
  }
}
