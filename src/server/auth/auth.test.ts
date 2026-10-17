import { describe, expect, it } from "vitest";
import { readAuthConfig } from "./config";
import { hashPassword, verifyPassword } from "./password";
import { authorize, can } from "./policy";
import { createAttemptLimiter } from "./rate-limit";
import { SESSION_TTL_SECONDS, createSessionToken, readSessionToken } from "./token";

const SECRET = "test-secret-0123456789abcdefghijklmnop";
const NOW = 1_800_000_000;

describe("session tokens", () => {
  it("round-trips a signed session", () => {
    const token = createSessionToken("editor", "jordan", SECRET, NOW);
    expect(readSessionToken(token, SECRET, NOW + 60)).toEqual({
      role: "editor",
      subject: "jordan",
      exp: NOW + SESSION_TTL_SECONDS,
    });
  });

  it("rejects a token signed with another secret", () => {
    const token = createSessionToken("editor", "jordan", "another-secret-0123456789abcdefghijk", NOW);
    expect(readSessionToken(token, SECRET, NOW)).toBeNull();
  });

  it("rejects a viewer token edited to claim the editor role", () => {
    const [data, signature] = createSessionToken("viewer", "demo", SECRET, NOW).split(".");
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    const forged = Buffer.from(JSON.stringify({ ...payload, role: "editor" })).toString("base64url");
    expect(readSessionToken(`${forged}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("rejects expired tokens", () => {
    const token = createSessionToken("editor", "jordan", SECRET, NOW);
    expect(readSessionToken(token, SECRET, NOW + SESSION_TTL_SECONDS)).toBeNull();
  });

  it.each([undefined, "", "abc", "a.b.c", "x".repeat(2000), "e30.AAAA"])("rejects malformed token %#", (token) => {
    expect(readSessionToken(token, SECRET, NOW)).toBeNull();
  });
});

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).toMatch(/^scrypt:32768:8:1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse batterY", hash)).toBe(false);
    expect(await hashPassword("correct horse battery")).not.toBe(hash); // salted
  });

  it("refuses short passwords", async () => {
    await expect(hashPassword("short")).rejects.toThrow(/at least 12/);
  });

  it.each([
    "plaintext-password",
    "scrypt:32768:8:1:c2FsdA",
    "scrypt:1073741824:8:1:AAAAAAAAAAAAAAAAAAAAAA:AAAA", // absurd cost parameter
    "bcrypt:10:abc:def:ghi:jkl",
    "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA", // wrong delimiter
  ])("never verifies a malformed or hostile hash: %s", async (stored) => {
    expect(await verifyPassword("anything", stored)).toBe(false);
  });
});

describe("auth config", () => {
  it("fails closed when settings are missing or weak", () => {
    expect(readAuthConfig({})).toEqual({ secret: null, editor: null, demoViewerEnabled: true });
    expect(readAuthConfig({ AUTH_SECRET: "too-short" }).secret).toBeNull();
    expect(readAuthConfig({ EDITOR_USERNAME: "jordan", EDITOR_PASSWORD_HASH: "hunter2" }).editor).toBeNull();
    // A hash mangled by "$" expansion or pasted in the old format is ignored, not trusted.
    expect(readAuthConfig({ EDITOR_USERNAME: "jordan", EDITOR_PASSWORD_HASH: "scrypt$x" }).editor).toBeNull();
    expect(readAuthConfig({ DEMO_VIEWER_ENABLED: "FALSE" }).demoViewerEnabled).toBe(false);
  });

  it("accepts a complete configuration", () => {
    expect(
      readAuthConfig({ AUTH_SECRET: SECRET, EDITOR_USERNAME: " jordan ", EDITOR_PASSWORD_HASH: "scrypt:x" }),
    ).toEqual({ secret: SECRET, editor: { username: "jordan", passwordHash: "scrypt:x" }, demoViewerEnabled: true });
  });
});

describe("authorization policy", () => {
  const editor = { role: "editor" as const, subject: "jordan", exp: NOW };
  const viewer = { role: "viewer" as const, subject: "demo", exp: NOW };

  it("only editors may write orders", () => {
    expect(can(editor, "orders:write")).toBe(true);
    expect(authorize(viewer, "orders:write")).toMatchObject({ ok: false, code: "forbidden" });
    expect(authorize(null, "orders:write")).toMatchObject({ ok: false, code: "unauthorized" });
  });

  it("any signed-in user may read and refresh the brief", () => {
    for (const session of [editor, viewer]) {
      expect(can(session, "orders:read")).toBe(true);
      expect(can(session, "brief:refresh")).toBe(true);
    }
    expect(can(null, "orders:read")).toBe(false);
  });
});

describe("sign-in attempt limiter", () => {
  it("blocks a key after repeated failures until the window ends", () => {
    let clock = 0;
    const limiter = createAttemptLimiter({ maxFailures: 3, windowMs: 60_000, now: () => clock });
    for (let i = 0; i < 3; i++) limiter.recordFailure("ip|jordan");
    expect(limiter.retryAfterSeconds("ip|jordan")).toBe(60);
    expect(limiter.retryAfterSeconds("other|jordan")).toBe(0);
    clock = 60_001;
    expect(limiter.retryAfterSeconds("ip|jordan")).toBe(0);
  });

  it("clears on success", () => {
    const limiter = createAttemptLimiter({ maxFailures: 1 });
    limiter.recordFailure("k");
    limiter.reset("k");
    expect(limiter.retryAfterSeconds("k")).toBe(0);
  });
});
