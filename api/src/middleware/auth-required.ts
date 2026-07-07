import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env";
import { verifySessionToken } from "../lib/jwt";

export const SESSION_COOKIE_NAME = "session";

/**
 * Verifies the session JWT cookie and sets `userId`/`emailVerified` in
 * context. Note this checks the JWT's `emailVerified` claim as frozen at
 * login time, not a fresh DB read (spec section 5.3) -- pair with
 * `emailVerifiedRequired` (middleware/email-verified-required.ts) on any
 * route that must actually enforce verification, since this middleware alone
 * only authenticates, it does not gate on verification status.
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

  c.set("userId", payload.sub);
  c.set("emailVerified", payload.emailVerified);
  await next();
});
