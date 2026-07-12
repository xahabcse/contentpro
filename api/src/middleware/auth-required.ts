import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { AppEnv, Env } from "../env";
import { verifySessionToken } from "../lib/jwt";

export const SESSION_COOKIE_NAME = "session";

function mongoStub(env: Env) {
  const id = env.MONGO_DO.idFromName("global-mongo-connection");
  return env.MONGO_DO.get(id);
}

/**
 * Verifies the session JWT cookie and sets `userId`/`emailVerified` in
 * context. Two checks:
 *   1. Signature + `type: "session"` + expiry (lib/jwt.ts).
 *   2. The token's `v` (tokenVersion at issuance) still matches the user's
 *      current tokenVersion in Mongo -- this is the session-revocation gate.
 *      A password reset (and forgot-password / resend-verification) bumps
 *      tokenVersion, which instantly invalidates every outstanding session
 *      cookie. Costs one findUserById per request; that is the accepted price
 *      of being able to revoke live sessions.
 *
 * `emailVerified` is still taken from the JWT claim frozen at login (spec 5.3),
 * not the fresh DB read -- a user who verifies mid-session must log in again to
 * get a JWT carrying `emailVerified: true`. Pair with `emailVerifiedRequired`
 * to actually gate on verification.
 */
export const authRequired = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (!token) {
    return c.json({ error: "UNAUTHENTICATED" }, 401);
  }

  const payload = await verifySessionToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: "UNAUTHENTICATED" }, 401);
  }

  const user = await mongoStub(c.env).findUserById(payload.sub);
  if (!user || user.tokenVersion !== payload.v) {
    return c.json({ error: "UNAUTHENTICATED" }, 401);
  }

  c.set("userId", payload.sub);
  c.set("emailVerified", payload.emailVerified);
  await next();
});
