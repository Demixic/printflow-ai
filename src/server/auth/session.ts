import { cache } from "react";
import { cookies } from "next/headers";
import { readAuthConfig } from "./config";
import { authorize, type AuthorizationResult, type Permission } from "./policy";
import { SESSION_COOKIE } from "./session-cookie";
import { SESSION_TTL_SECONDS, createSessionToken, readSessionToken, type Role, type Session } from "./token";

export { SESSION_COOKIE };

/**
 * The current request's session, verified from the signed cookie. This is the
 * authoritative check: call it (via `requirePermission`) in every server
 * action and data read, not just in the UI or proxy.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const { secret } = readAuthConfig();
  if (!secret) return null;
  return readSessionToken((await cookies()).get(SESSION_COOKIE)?.value, secret);
});

export async function requirePermission(permission: Permission): Promise<AuthorizationResult> {
  return authorize(await getSession(), permission);
}

export async function startSession(role: Role, subject: string): Promise<boolean> {
  const { secret } = readAuthConfig();
  if (!secret) return false;
  (await cookies()).set(SESSION_COOKIE, createSessionToken(role, subject, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return true;
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
