import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env";

/**
 * The actual enforcement of spec decision 6 / section 5.3: rejects with
 * 403 EMAIL_NOT_VERIFIED whenever the session JWT's `emailVerified` claim is
 * false. This checks the claim set by `authRequired`, not a fresh Mongo read
 * -- a user who verifies mid-session must log in again to get a JWT carrying
 * `emailVerified: true`. Must run after `authRequired` on every route that
 * needs it (all Profile routes; designs are browser-only now).
 */
export const emailVerifiedRequired = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("emailVerified")) {
    return c.json({ error: "EMAIL_NOT_VERIFIED" }, 403);
  }
  await next();
});
