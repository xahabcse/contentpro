import { createMiddleware } from "hono/factory";
import type { AppEnv, Env } from "../env";
import { isAdminEmail } from "../lib/admin";

function mongoStub(env: Env) {
  const id = env.MONGO_DO.idFromName("global-mongo-connection");
  return env.MONGO_DO.get(id);
}

/**
 * Gates admin-only routes. Must run AFTER `authRequired` (which sets `userId`).
 * `authRequired` only carries the userId, so we load the user doc to read its
 * email and check it against the ADMIN_EMAILS allowlist. Rejects with 403
 * FORBIDDEN for any authenticated-but-non-admin session.
 *
 * The emailVerified check is NOT redundant with the allowlist: signup is open
 * to anyone (spec 5.5), and an account is issued a session JWT even while
 * unverified. Without this, anyone could register an allowlisted address that
 * is not yet a user -- picking their own password, never needing the inbox --
 * and inherit full admin access. Requiring proven control of the mailbox makes
 * the allowlist mean what it is documented to mean. Kept inside this middleware
 * rather than at each route so no future admin route can omit it.
 */
export const adminRequired = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("emailVerified")) {
    return c.json({ error: "FORBIDDEN" }, 403);
  }
  const user = await mongoStub(c.env).findUserById(c.get("userId"));
  if (!user || !isAdminEmail(c.env, user.email)) {
    return c.json({ error: "FORBIDDEN" }, 403);
  }
  await next();
});
