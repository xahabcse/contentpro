import { Hono } from "hono";
import type { AppEnv } from "../env";
import { isAdminEmail } from "../lib/admin";
import { deleteUserById, findUserById, getAdminOverview, listAllUsers, listAuthEvents } from "../lib/db";
import { authRequired } from "../middleware/auth-required";
import { adminRequired } from "../middleware/admin-required";
import { logAuthEvent } from "../lib/auth-events";
import { deleteProfileImages } from "../lib/storage";

const admin = new Hono<AppEnv>();

// Every admin route needs a valid session; the admin-only ones additionally
// pass through `adminRequired` (403 FORBIDDEN for non-admins).
admin.use("*", authRequired);

// Reports the flag only -- never 403s -- so the frontend can gate its admin UI
// for the current session without a separate error path.
admin.get("/me", async (c) => {
  const user = await findUserById(c.env.DB, c.get("userId"));
  // Mirrors adminRequired exactly (including its emailVerified condition) so
  // the UI never advertises an admin surface the API would then 403.
  const isAdmin = !!user && c.get("emailVerified") && isAdminEmail(c.env, user.email);
  return c.json({ isAdmin });
});

admin.get("/overview", adminRequired, async (c) => {
  return c.json({ overview: await getAdminOverview(c.env.DB) });
});

admin.get("/users", adminRequired, async (c) => {
  const users = (await listAllUsers(c.env.DB)).map((u) => ({
    id: u._id,
    email: u.email,
    name: u.profile.name ?? null,
    handle: u.profile.handle ?? null,
    emailVerified: u.emailVerified,
    designation: u.profile.designation ?? null,
    companyName: u.profile.companyName ?? null,
    createdAt: u.createdAt,
  }));
  return c.json({ users });
});

admin.delete("/users/:id", adminRequired, async (c) => {
  const target = await findUserById(c.env.DB, c.req.param("id"));
  if (!target) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }
  // Never let an admin delete an admin (including self) -- deleting the only
  // allowlisted account would lock everyone out of the admin surface.
  if (isAdminEmail(c.env, target.email)) {
    return c.json({ error: "CANNOT_DELETE_ADMIN" }, 400);
  }
  // Keep the account retryable if R2 is temporarily unavailable. Deleting the
  // row first would strand private images with no account left to find them.
  await deleteProfileImages(c.env.PROFILE_IMAGES, target._id);
  const deleted = await deleteUserById(c.env.DB, target._id);
  if (!deleted) return c.json({ error: "NOT_FOUND" }, 404);
  // Account deletion is the most destructive operation this API exposes -- it
  // belongs in the same audit trail that already records logins and resets, so
  // a compromised admin session leaves a record. `email` is the deleted
  // account; `detail` names the acting admin.
  c.executionCtx.waitUntil(
    logAuthEvent(c, {
      type: "admin_delete_user",
      email: target.email,
      detail: `deleted by admin userId ${c.get("userId")}`,
    }),
  );
  return c.json({ ok: true });
});

const DEFAULT_LOG_LIMIT = 100;
const MAX_LOG_LIMIT = 200;

admin.get("/logs", adminRequired, async (c) => {
  const raw = Number.parseInt(c.req.query("limit") ?? "", 10);
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, MAX_LOG_LIMIT) : DEFAULT_LOG_LIMIT;
  const events = await listAuthEvents(c.env.DB, limit);
  return c.json({ events });
});

export default admin;
