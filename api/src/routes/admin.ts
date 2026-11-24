import { Hono, type Context } from "hono";
import type { AppEnv } from "../env";
import { isAdminEmail } from "../lib/admin";
import {
  authLogSummary,
  countDeletedUsers,
  findDeletedUsers,
  findUserById,
  getAdminOverview,
  listAllUsers,
  listAuthEvents,
  listDeletedUsers,
  purgeAuthEventsBefore,
  purgeDeletedUser,
  restoreDeletedUser,
  softDeleteUser,
} from "../lib/db";
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
  // The account keeps its row with status 404 and its sessions end at once; Cleanup restores it or deletes it for
  // good with its profile images. It belongs in the same audit trail as logins and resets, so a compromised admin
  // session leaves a record: `email` is the account, `detail` names the acting admin.
  const deleted = await softDeleteUser(c.env.DB, target._id);
  if (!deleted) return c.json({ error: "NOT_FOUND" }, 404);
  c.executionCtx.waitUntil(
    logAuthEvent(c, {
      type: "admin_delete_user",
      email: target.email,
      detail: `moved to Cleanup by admin userId ${c.get("userId")}`,
    }),
  );
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Cleanup: deleted accounts (status 404) and the security log. Same shape as
// the portfolio's and NewsPortal's, so admin.xahabcse.me shows one page.
// ---------------------------------------------------------------------------

const PAGE_LIMIT_MAX = 100;
const LOG_AGES = [7, 14, 30] as const;
const LOG_CHUNK = 500;
const LOG_ROUNDS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

function readCount(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value ?? "");
  return Number.isInteger(parsed) && parsed >= 1 ? Math.min(parsed, max) : fallback;
}

function isPeopleGroup(value: unknown): boolean {
  return value === "people" || value === "all";
}

// Profile images go first, as the old hard delete did: a row deleted before its
// images would strand private files with no account left to find them. An
// account whose images R2 refuses stays in Cleanup for the next try.
async function purgeAccounts(c: Context<AppEnv>, accounts: { id: string; email: string }[]) {
  let removed = 0;
  const kept: string[] = [];
  for (const account of accounts) {
    try {
      await deleteProfileImages(c.env.PROFILE_IMAGES, account.id);
    } catch {
      kept.push(`${account.email} (images could not be removed; try again)`);
      continue;
    }
    if (await purgeDeletedUser(c.env.DB, account.id)) {
      removed++;
      c.executionCtx.waitUntil(
        logAuthEvent(c, { type: "admin_purge_user", email: account.email, detail: `deleted for good by admin userId ${c.get("userId")}` }),
      );
    }
  }
  return { removed: { user: removed }, kept };
}

admin.get("/cleanup/summary", adminRequired, async (c) => {
  const users = await countDeletedUsers(c.env.DB);
  return c.json({ kinds: { user: users }, groups: { people: users } });
});

admin.get("/cleanup/items", adminRequired, async (c) => {
  if (!isPeopleGroup(c.req.query("group") ?? "all")) return c.json({ error: "UNKNOWN_GROUP" }, 400);
  const page = readCount(c.req.query("page"), 1, 10_000);
  const limit = readCount(c.req.query("limit"), 50, PAGE_LIMIT_MAX);
  const [rows, total] = await Promise.all([listDeletedUsers(c.env.DB, page, limit), countDeletedUsers(c.env.DB)]);
  const items = rows.map((row) => ({
    kind: "user",
    id: row.id,
    label: row.name ?? row.email,
    detail: `Account · ${row.email}`,
    deletedAt: new Date(row.deletedAt).toISOString(),
  }));
  return c.json({ items, total, page, limit });
});

admin.post("/cleanup/user/:id/restore", adminRequired, async (c) => {
  const id = c.req.param("id");
  if (!(await restoreDeletedUser(c.env.DB, id))) return c.json({ error: "NOT_FOUND" }, 404);
  c.executionCtx.waitUntil(logAuthEvent(c, { type: "admin_restore_user", detail: `account ${id} restored by admin userId ${c.get("userId")}` }));
  return c.json({ ok: true });
});

admin.post("/cleanup/user/:id/purge", adminRequired, async (c) => {
  return c.json(await purgeAccounts(c, await findDeletedUsers(c.env.DB, c.req.param("id"))));
});

admin.post("/cleanup/purge", adminRequired, async (c) => {
  const body = await c.req.json<{ group?: unknown }>().catch(() => ({ group: undefined }));
  if (!isPeopleGroup(body.group)) return c.json({ error: "UNKNOWN_GROUP" }, 400);
  return c.json(await purgeAccounts(c, await findDeletedUsers(c.env.DB, null)));
});

admin.get("/cleanup/logs", adminRequired, async (c) => {
  const s = await authLogSummary(c.env.DB);
  const auth = {
    total: s.total,
    oldest: s.oldest === null ? null : new Date(s.oldest).toISOString(),
    olderThan: { 7: s.older7, 14: s.older14, 30: s.older30 },
  };
  return c.json({ logs: { auth } });
});

// A deleted row costs a write for the table and one for its index, so one call
// stays inside LOG_ROUNDS chunks and says whether rows are left.
admin.post("/cleanup/logs/auth/purge", adminRequired, async (c) => {
  const body = await c.req.json<{ days?: unknown }>().catch(() => ({ days: undefined }));
  const days = LOG_AGES.find((age) => age === body.days);
  if (days === undefined) return c.json({ error: "DAYS_MUST_BE_7_14_OR_30" }, 400);
  const cutoff = Date.now() - days * DAY_MS;
  let removed = 0;
  for (let round = 0; round < LOG_ROUNDS; round++) {
    const changes = await purgeAuthEventsBefore(c.env.DB, cutoff, LOG_CHUNK);
    removed += changes;
    if (changes < LOG_CHUNK) return c.json({ removed, more: false });
  }
  return c.json({ removed, more: true });
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
