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
 */
export const adminRequired = createMiddleware<AppEnv>(async (c, next) => {
  const user = await mongoStub(c.env).findUserById(c.get("userId"));
  if (!user || !isAdminEmail(c.env, user.email)) {
    return c.json({ error: "FORBIDDEN" }, 403);
  }
  await next();
});
