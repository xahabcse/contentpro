import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env";

/**
 * The actual enforcement of spec decision 6 / section 5.3: rejects with
 * 403 EMAIL_NOT_VERIFIED whenever the account is not verified. `authRequired`
 * sets the flag from its database read, so verifying mid-session takes effect
 * on the next request, without logging in again. Must run after `authRequired`
 * on every route that needs it (all Profile routes; designs are browser-only now).
 */
export const emailVerifiedRequired = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("emailVerified")) {
    return c.json({ error: "EMAIL_NOT_VERIFIED" }, 403);
  }
  await next();
});
