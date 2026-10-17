/**
 * Authentication settings, read from the server environment only.
 *
 *   AUTH_SECRET           ≥ 32 characters; signs session cookies. Required for any sign-in.
 *   EDITOR_USERNAME       Editor login name.
 *   EDITOR_PASSWORD_HASH  scrypt hash from `npm run auth:hash-password`; never a plain password.
 *   DEMO_VIEWER_ENABLED   "false" hides the read-only demo button. Default: enabled.
 *
 * Anything missing or invalid fails closed: no secret → nobody can sign in;
 * no editor credentials → nobody can edit.
 */
export interface AuthConfig {
  secret: string | null;
  editor: { username: string; passwordHash: string } | null;
  demoViewerEnabled: boolean;
}

export const MIN_SECRET_LENGTH = 32;

export function readAuthConfig(env: Record<string, string | undefined> = process.env): AuthConfig {
  const secret = env.AUTH_SECRET?.trim() ?? "";
  const username = env.EDITOR_USERNAME?.trim() ?? "";
  const passwordHash = env.EDITOR_PASSWORD_HASH?.trim() ?? "";
  return {
    secret: secret.length >= MIN_SECRET_LENGTH ? secret : null,
    editor: username && passwordHash.startsWith("scrypt:") ? { username, passwordHash } : null,
    demoViewerEnabled: env.DEMO_VIEWER_ENABLED?.trim().toLowerCase() !== "false",
  };
}
