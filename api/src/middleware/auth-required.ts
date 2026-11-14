import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env";
import { findUserById } from "../lib/db";
import { verifySessionToken } from "../lib/jwt";

export const SESSION_COOKIE_NAME = "session";

/**
 * Verifies the session JWT cookie and sets `userId`/`emailVerified` in
 * context. Two checks:
 *   1. Signature + `type: "session"` + expiry (lib/jwt.ts).
 *   2. The token's `v` (sessionVersion at issuance) still matches the user's
 *      current sessionVersion in the database -- the session-revocation gate.
 *      Only a successful password reset bumps sessionVersion, which instantly
 *      invalidates every outstanding session cookie. Costs one findUserById per
 *      request; that is the accepted price of being able to revoke live
 *      sessions.
 *
 *      This deliberately does NOT gate on `tokenVersion`: that counter is
 *      incremented by the unauthenticated /forgot-password and
 *      /resend-verification routes, so gating sessions on it meant anyone who
 *      knew a victim's email address could force-log-out that account at will.
 *      tokenVersion still governs email-verification / password-reset links
 *      (spec 5.3/5.4); session revocation is a separate counter.
 *
 * `emailVerified` is still taken from the JWT claim frozen at login (spec 5.3),
 * not the fresh DB read -- a user who verifies mid-session must log in again to
 * get a JWT carrying `emailVerified: true`. Pair with `emailVerifiedRequired`
 * to actually gate on verification.
 */
export const authRequired = createMiddleware<AppEnv>(async (c, next) => {
  // The private AdminGateway has already resolved the admin and set userId/emailVerified.
  // The public app never sets this flag, so nothing from the internet can.
  if (c.get("viaAdminGateway") === true) {
    await next();
    return;
  }

  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (!token) {
    return c.json({ error: "UNAUTHENTICATED" }, 401);
  }

  const payload = await verifySessionToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: "UNAUTHENTICATED" }, 401);
  }

  const user = await findUserById(c.env.DB, payload.sub);
  if (!user || (user.sessionVersion ?? 0) !== payload.v) {
    return c.json({ error: "UNAUTHENTICATED" }, 401);
  }

  c.set("userId", payload.sub);
  c.set("emailVerified", payload.emailVerified);
  await next();
});
