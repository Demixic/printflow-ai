import type { Role, Session } from "./token";

export type Permission = "orders:read" | "orders:write" | "brief:refresh";

const GRANTS: Record<Role, readonly Permission[]> = {
  editor: ["orders:read", "orders:write", "brief:refresh"],
  // The read-only demo can look and ask for a fresh brief (rate-limited server-side), never write.
  viewer: ["orders:read", "brief:refresh"],
};

export type AuthorizationResult =
  | { ok: true; session: Session }
  | { ok: false; code: "unauthorized" | "forbidden"; message: string };

export function authorize(session: Session | null, permission: Permission): AuthorizationResult {
  if (!session) {
    return { ok: false, code: "unauthorized", message: "Your session has expired. Sign in again to continue." };
  }
  if (!GRANTS[session.role].includes(permission)) {
    return {
      ok: false,
      code: "forbidden",
      message: "The read-only demo can't change orders. Sign in as an editor to make changes.",
    };
  }
  return { ok: true, session };
}

export function can(session: Session | null, permission: Permission): boolean {
  return authorize(session, permission).ok;
}
