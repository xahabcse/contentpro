import { Hono } from "hono";
import type { AppEnv, Env } from "../env";
import { isAdminEmail } from "../lib/admin";
import { authRequired } from "../middleware/auth-required";
import { adminRequired } from "../middleware/admin-required";

const admin = new Hono<AppEnv>();

function mongoStub(env: Env) {
  const id = env.MONGO_DO.idFromName("global-mongo-connection");
  return env.MONGO_DO.get(id);
}

// Every admin route needs a valid session; the admin-only ones additionally
// pass through `adminRequired` (403 FORBIDDEN for non-admins).
admin.use("*", authRequired);

// Reports the flag only -- never 403s -- so the frontend can gate its admin UI
// for the current session without a separate error path.
admin.get("/me", async (c) => {
  const user = await mongoStub(c.env).findUserById(c.get("userId"));
  return c.json({ isAdmin: !!user && isAdminEmail(c.env, user.email) });
});

admin.get("/users", adminRequired, async (c) => {
  const users = (await mongoStub(c.env).listAllUsers()).map((u) => ({
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
  const stub = mongoStub(c.env);
  const target = await stub.findUserById(c.req.param("id"));
  if (!target) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }
  // Never let an admin delete an admin (including self) -- deleting the only
  // allowlisted account would lock everyone out of the admin surface.
  if (isAdminEmail(c.env, target.email)) {
    return c.json({ error: "CANNOT_DELETE_ADMIN" }, 400);
  }
  await stub.deleteUserById(target._id);
  return c.json({ ok: true });
});

const DEFAULT_LOG_LIMIT = 100;
const MAX_LOG_LIMIT = 200;

admin.get("/logs", adminRequired, async (c) => {
  const raw = Number.parseInt(c.req.query("limit") ?? "", 10);
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, MAX_LOG_LIMIT) : DEFAULT_LOG_LIMIT;
  const events = await mongoStub(c.env).listAuthEvents(limit);
  return c.json({ events });
});

export default admin;
