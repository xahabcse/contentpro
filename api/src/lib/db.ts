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
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`)
    .bind(email.toLowerCase())
    .first<UserRow>();
  return row ? toUserRecord(row) : null;
}

export async function findUserById(db: D1Database, id: string): Promise<UserRecord | null> {
  const row = await db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`)
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
 * A present `profile` key replaces ALL SIX profile columns -- also matching the
 * old `$set: { profile }`, which replaced the whole subdocument. Callers always
 * pass a fully merged profile (`{ ...user.profile, ...updates }`), so this is a
 * whole-object write by design, not a partial one.
 */
export async function updateUser(
  db: D1Database,
  id: string,
  update: UserUpdateInput,
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
  if ("profile" in update && update.profile !== undefined) {
    const profile = update.profile;
    set("profile_name", profile.name ?? null);
    set("profile_designation", profile.designation ?? null);
    set("profile_photo_url", profile.photoUrl ?? null);
    set("profile_company_name", profile.companyName ?? null);
    set("profile_company_logo_url", profile.companyLogoUrl ?? null);
    set("profile_handle", profile.handle ?? null);
  }

  if (assignments.length === 0) return;

  await db
    .prepare(`UPDATE users SET ${assignments.join(", ")} WHERE id = ?`)
    .bind(...values, id)
    .run();
}

// ---------------------------------------------------------------------------
// admin: user listing + deletion
// ---------------------------------------------------------------------------

export async function listAllUsers(db: D1Database): Promise<UserRecord[]> {
  const { results } = await db
    .prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY created_at DESC`)
    .all<UserRow>();
  return results.map(toUserRecord);
}

export async function deleteUserById(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  return result.meta.changes === 1;
}

// ---------------------------------------------------------------------------
// auth_events (best-effort audit trail; read-only via the admin API)
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
