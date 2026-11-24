import type {
  AuthEventRecord,
  AuthEventType,
  NewAuthEventInput,
  NewUserInput,
  UserProfile,
  UserRecord,
  UserUpdateInput,
} from "../schema";

/**
 * D1 data access. Free functions taking the `DB` binding as their first
 * argument, named to match the RPC methods this replaced on the old
 * MongoConnectionDO so call sites stayed mechanical.
 *
 * This module is the ONLY place the snake_case SQL columns and the camelCase
 * `UserRecord`/`AuthEventRecord` shapes in schema.ts meet, and the only place
 * epoch-ms INTEGER timestamps are converted to/from `Date`. Everything above
 * this boundary keeps working in the domain types.
 */

// See routes/auth.ts -- signup turns this exact message into a 409 EMAIL_IN_USE.
// Kept as a sentinel Error (rather than a custom error class) because that is
// the contract the route already matches on.
const DUPLICATE_EMAIL_ERROR = "DUPLICATE_EMAIL";

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  email_verified: number;
  token_version: number;
  session_version: number;
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
  profile_name: string | null;
  profile_designation: string | null;
  profile_photo_url: string | null;
  profile_company_name: string | null;
  profile_company_logo_url: string | null;
  profile_handle: string | null;
}

interface AuthEventRow {
  ts: number;
  type: string;
  email: string | null;
  ip: string | null;
  detail: string | null;
}

const USER_COLUMNS =
  "id, email, password_hash, password_salt, password_iterations, email_verified, token_version, session_version, created_at, updated_at, last_login_at, profile_name, profile_designation, profile_photo_url, profile_company_name, profile_company_logo_url, profile_handle";

/** Omits keys whose column is NULL so optional profile fields stay `undefined`, not `null`. */
function toProfile(row: UserRow): UserProfile {
  const profile: UserProfile = {};
  if (row.profile_name !== null) profile.name = row.profile_name;
  if (row.profile_designation !== null) profile.designation = row.profile_designation;
  if (row.profile_photo_url !== null) profile.photoUrl = row.profile_photo_url;
  if (row.profile_company_name !== null) profile.companyName = row.profile_company_name;
  if (row.profile_company_logo_url !== null) profile.companyLogoUrl = row.profile_company_logo_url;
  if (row.profile_handle !== null) profile.handle = row.profile_handle;
  return profile;
}

function toUserRecord(row: UserRow): UserRecord {
  return {
    _id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    passwordIterations: row.password_iterations,
    emailVerified: row.email_verified === 1,
    tokenVersion: row.token_version,
    sessionVersion: row.session_version,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    ...(row.last_login_at !== null ? { lastLoginAt: new Date(row.last_login_at) } : {}),
    profile: toProfile(row),
  };
}

/**
 * Matches D1's UNIQUE-index violation. Verified empirically (forced insert
 * collision against local D1) rather than guessed -- the thrown value is a
 * plain Error with NO enumerable own properties, so there is no numeric `code`
 * to switch on and the message text is the only signal available:
 *
 *   name:    "Error"
 *   message: "D1_ERROR: UNIQUE constraint failed: users.email: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)"
 *   cause:   Error("UNIQUE constraint failed: users.email: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)")
 *
 * The outer message alone is enough today; the `cause` chain is walked as well
 * so this keeps working if D1 ever makes the outer message generic and leaves
 * the SQLite text only on the cause.
 */
function isUniqueConstraintError(err: unknown): boolean {
  for (let cursor: unknown = err, depth = 0; cursor && depth < 5; depth++) {
    const message = (cursor as { message?: unknown }).message;
    if (typeof message === "string" && /UNIQUE constraint failed/i.test(message)) return true;
    cursor = (cursor as { cause?: unknown }).cause;
  }
  return false;
}

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export async function findUserByEmail(db: D1Database, email: string): Promise<UserRecord | null> {
  const row = await db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ? AND status <> 404`)
    .bind(email.toLowerCase())
    .first<UserRow>();
  return row ? toUserRecord(row) : null;
}

export async function findUserById(db: D1Database, id: string): Promise<UserRecord | null> {
  const row = await db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ? AND status <> 404`)
    .bind(id)
    .first<UserRow>();
  return row ? toUserRecord(row) : null;
}

export async function insertUser(db: D1Database, user: NewUserInput): Promise<string> {
  // Migrated accounts kept their Mongo ObjectId hex string as the id, so ids
  // are deliberately format-mixed. Nothing parses them -- they are opaque keys.
  const id = crypto.randomUUID();
  try {
    await db
      .prepare(
        `INSERT INTO users (
           id, email, password_hash, password_salt, password_iterations,
           email_verified, token_version, session_version,
           created_at, updated_at, last_login_at,
           profile_name, profile_designation, profile_photo_url,
           profile_company_name, profile_company_logo_url, profile_handle
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        user.email.toLowerCase(),
        user.passwordHash,
        user.passwordSalt,
        user.passwordIterations,
        user.emailVerified ? 1 : 0,
        user.tokenVersion,
        user.sessionVersion ?? 0,
        user.createdAt.getTime(),
        user.updatedAt.getTime(),
        user.lastLoginAt ? user.lastLoginAt.getTime() : null,
        user.profile.name ?? null,
        user.profile.designation ?? null,
        user.profile.photoUrl ?? null,
        user.profile.companyName ?? null,
        user.profile.companyLogoUrl ?? null,
        user.profile.handle ?? null,
      )
      .run();
  } catch (err) {
    // Maps the unique-email violation to the stable sentinel the signup route
    // turns into a 409 (see routes/auth.ts).
    if (isUniqueConstraintError(err)) throw new Error(DUPLICATE_EMAIL_ERROR);
    throw err;
  }
  return id;
}

/**
 * Builds the SET clause from only the keys actually present on `update`,
 * mirroring Mongo's `$set` semantics: absent keys are left untouched, an
 * explicitly present key is written even if its value is falsy.
 *
 * Profile fields are deliberately handled by patchUserProfile below. Writing a
 * read/merged profile as one object would lose concurrent text/image updates.
 */
export async function updateUser(
  db: D1Database,
  id: string,
  update: Omit<UserUpdateInput, "profile">,
): Promise<void> {
  const assignments: string[] = [];
  const values: (string | number | null)[] = [];

  const set = (column: string, value: string | number | null) => {
    assignments.push(`${column} = ?`);
    values.push(value);
  };

  if ("email" in update && update.email !== undefined) set("email", update.email.toLowerCase());
  if ("passwordHash" in update && update.passwordHash !== undefined) set("password_hash", update.passwordHash);
  if ("passwordSalt" in update && update.passwordSalt !== undefined) set("password_salt", update.passwordSalt);
  if ("passwordIterations" in update && update.passwordIterations !== undefined) set("password_iterations", update.passwordIterations);
  if ("emailVerified" in update && update.emailVerified !== undefined) set("email_verified", update.emailVerified ? 1 : 0);
  if ("tokenVersion" in update && update.tokenVersion !== undefined) set("token_version", update.tokenVersion);
  if ("sessionVersion" in update && update.sessionVersion !== undefined) set("session_version", update.sessionVersion);
  if ("createdAt" in update && update.createdAt !== undefined) set("created_at", update.createdAt.getTime());
  if ("updatedAt" in update && update.updatedAt !== undefined) set("updated_at", update.updatedAt.getTime());
  if ("lastLoginAt" in update && update.lastLoginAt !== undefined) set("last_login_at", update.lastLoginAt.getTime());
  if (assignments.length === 0) return;

  await db
    .prepare(`UPDATE users SET ${assignments.join(", ")} WHERE id = ?`)
    .bind(...values, id)
    .run();
}

/**
 * Records a successful login, and optionally upgrades its password hash, only
 * while the session version observed during password verification is current.
 * A concurrent password reset increments that version; without this condition
 * a late rehash could restore the old password after the reset completed.
 */
export async function recordLoginIfSessionVersion(
  db: D1Database,
  id: string,
  expectedSessionVersion: number,
  rehash?: { hash: string; salt: string; iterations: number },
): Promise<boolean> {
  const assignments = ["last_login_at = ?"];
  const values: (string | number)[] = [Date.now()];
  if (rehash) {
    assignments.push("password_hash = ?", "password_salt = ?", "password_iterations = ?");
    values.push(rehash.hash, rehash.salt, rehash.iterations);
  }
  const result = await db
    .prepare(`UPDATE users SET ${assignments.join(", ")} WHERE id = ? AND session_version = ?`)
    .bind(...values, id, expectedSessionVersion)
    .run();
  return result.meta.changes === 1;
}

const PROFILE_COLUMNS: Record<keyof UserProfile, string> = {
  name: "profile_name",
  designation: "profile_designation",
  photoUrl: "profile_photo_url",
  companyName: "profile_company_name",
  companyLogoUrl: "profile_company_logo_url",
  handle: "profile_handle",
};

/** Updates only supplied profile columns, preserving concurrent changes elsewhere. */
export async function patchUserProfile(db: D1Database, id: string, patch: UserProfile): Promise<boolean> {
  const assignments: string[] = [];
  const values: (string | number)[] = [];
  for (const field of Object.keys(PROFILE_COLUMNS) as (keyof UserProfile)[]) {
    const value = patch[field];
    if (value !== undefined) {
      assignments.push(`${PROFILE_COLUMNS[field]} = ?`);
      values.push(value);
    }
  }
  if (assignments.length === 0) return true;
  assignments.push("updated_at = ?");
  values.push(Date.now());
  const result = await db
    .prepare(`UPDATE users SET ${assignments.join(", ")} WHERE id = ?`)
    .bind(...values, id)
    .run();
  return result.meta.changes === 1;
}

/** Consumes one reset token atomically and revokes existing sessions. */
export async function resetUserPasswordIfTokenVersion(
  db: D1Database,
  id: string,
  expectedTokenVersion: number,
  password: { hash: string; salt: string; iterations: number },
): Promise<boolean> {
  const result = await db
    .prepare(`UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?,
              token_version = token_version + 1, session_version = session_version + 1,
              updated_at = ? WHERE id = ? AND token_version = ?`)
    .bind(password.hash, password.salt, password.iterations, Date.now(), id, expectedTokenVersion)
    .run();
  return result.meta.changes === 1;
}

// ---------------------------------------------------------------------------
// admin: user listing + deletion
// ---------------------------------------------------------------------------

export interface AdminOverview {
  totalUsers: number;
  verifiedUsers: number;
  newUsers24h: number;
  newUsers7d: number;
  successfulLogins7d: number;
  failedLogins7d: number;
  failedLoginIps7d: number;
}

/** Exact aggregate counts; independent of the 200-row security log preview. */
export async function getAdminOverview(db: D1Database, nowMs = Date.now()): Promise<AdminOverview> {
  const since24h = nowMs - 24 * 60 * 60 * 1000;
  const since7d = nowMs - 7 * 24 * 60 * 60 * 1000;
  const [users, events] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS totalUsers,
      COUNT(CASE WHEN email_verified = 1 THEN 1 END) AS verifiedUsers,
      COUNT(CASE WHEN created_at >= ? THEN 1 END) AS newUsers24h,
      COUNT(CASE WHEN created_at >= ? THEN 1 END) AS newUsers7d
      FROM users WHERE status <> 404`).bind(since24h, since7d).first<Pick<AdminOverview,
      "totalUsers" | "verifiedUsers" | "newUsers24h" | "newUsers7d">>(),
    db.prepare(`SELECT
      COUNT(CASE WHEN type = 'login' THEN 1 END) AS successfulLogins7d,
      COUNT(CASE WHEN type = 'login_failed' THEN 1 END) AS failedLogins7d,
      COUNT(DISTINCT CASE WHEN type = 'login_failed' AND TRIM(ip) <> '' THEN ip END) AS failedLoginIps7d
      FROM auth_events WHERE ts >= ?`).bind(since7d).first<Pick<AdminOverview,
      "successfulLogins7d" | "failedLogins7d" | "failedLoginIps7d">>(),
  ]);
  return {
    totalUsers: users?.totalUsers ?? 0,
    verifiedUsers: users?.verifiedUsers ?? 0,
    newUsers24h: users?.newUsers24h ?? 0,
    newUsers7d: users?.newUsers7d ?? 0,
    successfulLogins7d: events?.successfulLogins7d ?? 0,
    failedLogins7d: events?.failedLogins7d ?? 0,
    failedLoginIps7d: events?.failedLoginIps7d ?? 0,
  };
}

export async function listAllUsers(db: D1Database): Promise<UserRecord[]> {
  const { results } = await db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE status <> 404 ORDER BY created_at DESC`)
    .all<UserRow>();
  return results.map(toUserRecord);
}

// ---------------------------------------------------------------------------
// Cleanup. An admin delete keeps the account with status 404 (learning's convention: Active 1, Inactive -1,
// Deleted 404); every lookup above skips it, so it cannot sign in. Cleanup restores it or deletes it for good.
// ---------------------------------------------------------------------------

export interface DeletedUserRow {
  id: string;
  email: string;
  name: string | null;
  deletedAt: number;
}

/** Status 404, and both version counters move on so no session cookie or emailed link of it works again. */
export async function softDeleteUser(db: D1Database, id: string, nowMs = Date.now()): Promise<boolean> {
  const result = await db
    .prepare(`UPDATE users SET status = 404, session_version = session_version + 1, token_version = token_version + 1,
      updated_at = ? WHERE id = ? AND status <> 404`)
    .bind(nowMs, id)
    .run();
  return result.meta.changes === 1;
}

export async function countDeletedUsers(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE status = 404").first<{ n: number }>();
  return row?.n ?? 0;
}

export async function listDeletedUsers(db: D1Database, page: number, limit: number): Promise<DeletedUserRow[]> {
  const { results } = await db
    .prepare(`SELECT id, email, profile_name AS name, updated_at AS deletedAt FROM users WHERE status = 404
      ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`)
    .bind(limit, (page - 1) * limit)
    .all<DeletedUserRow>();
  return results;
}

export async function restoreDeletedUser(db: D1Database, id: string, nowMs = Date.now()): Promise<boolean> {
  const result = await db.prepare("UPDATE users SET status = 1, updated_at = ? WHERE id = ? AND status = 404").bind(nowMs, id).run();
  return result.meta.changes === 1;
}

export async function findDeletedUsers(db: D1Database, id: string | null): Promise<{ id: string; email: string }[]> {
  const { results } = await (id === null
    ? db.prepare("SELECT id, email FROM users WHERE status = 404")
    : db.prepare("SELECT id, email FROM users WHERE status = 404 AND id = ?").bind(id)
  ).all<{ id: string; email: string }>();
  return results;
}

export async function purgeDeletedUser(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM users WHERE id = ? AND status = 404").bind(id).run();
  return result.meta.changes === 1;
}

export interface AuthLogSummary {
  total: number;
  oldest: number | null;
  older7: number;
  older14: number;
  older30: number;
}

export async function authLogSummary(db: D1Database, nowMs = Date.now()): Promise<AuthLogSummary> {
  const day = 24 * 60 * 60 * 1000;
  const row = await db
    .prepare(`SELECT COUNT(*) AS total, MIN(ts) AS oldest,
      COALESCE(SUM(ts < ?), 0) AS older7, COALESCE(SUM(ts < ?), 0) AS older14, COALESCE(SUM(ts < ?), 0) AS older30
      FROM auth_events`)
    .bind(nowMs - 7 * day, nowMs - 14 * day, nowMs - 30 * day)
    .first<AuthLogSummary>();
  return { total: row?.total ?? 0, oldest: row?.oldest ?? null, older7: row?.older7 ?? 0, older14: row?.older14 ?? 0, older30: row?.older30 ?? 0 };
}

/** One chunk of security-log rows older than the cut-off; the caller loops within its D1 write budget. */
export async function purgeAuthEventsBefore(db: D1Database, cutoffMs: number, chunk: number): Promise<number> {
  const result = await db
    .prepare("DELETE FROM auth_events WHERE id IN (SELECT id FROM auth_events WHERE ts < ? ORDER BY ts LIMIT ?)")
    .bind(cutoffMs, chunk)
    .run();
  return result.meta.changes ?? 0;
}

// ---------------------------------------------------------------------------
// auth_events (best-effort audit trail; the admin reads it, and Cleanup clears rows past 7, 14 or 30 days)
// ---------------------------------------------------------------------------

export async function insertAuthEvent(db: D1Database, event: NewAuthEventInput): Promise<void> {
  await db
    .prepare("INSERT INTO auth_events (ts, type, email, ip, detail) VALUES (?, ?, ?, ?, ?)")
    .bind(event.ts, event.type, event.email, event.ip, event.detail)
    .run();
}

export async function listAuthEvents(db: D1Database, limit: number): Promise<AuthEventRecord[]> {
  const { results } = await db
    .prepare("SELECT ts, type, email, ip, detail FROM auth_events ORDER BY ts DESC LIMIT ?")
    .bind(limit)
    .all<AuthEventRow>();
  return results.map((row) => ({
    ts: row.ts,
    type: row.type as AuthEventType,
    email: row.email,
    ip: row.ip,
    detail: row.detail,
  }));
}
