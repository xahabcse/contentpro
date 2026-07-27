import type { Env } from "../env";

/**
 * True when `email` (case-insensitive, trimmed) appears in the comma-separated
 * ADMIN_EMAILS allowlist. This is an allowlist check, not a credential check --
 * the caller must already be an authenticated session for this to gate access.
 */
export function isAdminEmail(env: Env, email: string | null | undefined): boolean {
  if (!email) return false;
  const target = email.trim().toLowerCase();
  if (!target) return false;
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(target);
}
