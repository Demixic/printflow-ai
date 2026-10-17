import { NextResponse, type NextRequest } from "next/server";
import { readAuthConfig } from "@/server/auth/config";
import { SESSION_COOKIE } from "@/server/auth/session-cookie";
import { readSessionToken } from "@/server/auth/token";

/**
 * Optimistic redirect only: sends signed-out page visits to /login and
 * signed-in visits away from it, before anything renders. It is not the
 * security boundary — pages and server actions verify the session themselves.
 * Server-action POSTs pass straight through so the actions return their own
 * "unauthorized" result.
 */
export function proxy(request: NextRequest) {
  if (request.method !== "GET" || request.headers.has("next-action")) return NextResponse.next();

  const { secret } = readAuthConfig();
  const session = secret ? readSessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret) : null;
  const onLogin = request.nextUrl.pathname === "/login";

  if (!session && !onLogin) return NextResponse.redirect(new URL("/login", request.url));
  if (session && onLogin) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login"],
};
