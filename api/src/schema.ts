// ---------------------------------------------------------------------------
// Domain types for the `users` table. Designs are browser-only (localStorage +
// IndexedDB) and are not persisted server-side, so the only user-owned table
// here is `users` (plus the `auth_events` audit trail below).
//
// These stay camelCase and `Date`-typed. The snake_case / epoch-ms SQL columns
// they map onto live in api/migrations, and the translation between the two
// happens exclusively in src/lib/db.ts.
// ---------------------------------------------------------------------------

export interface UserProfile {
  name?: string;
  designation?: string;
  /**
   * R2 object key (lib/storage.ts), NOT a URL -- the field name predates the
   * move back to R2 and is kept as-is to avoid a column rename. Responses map
   * it to the route that serves the bytes; the key itself never leaves the API.
   */
  photoUrl?: string;
  companyName?: string;
  /** R2 object key -- see photoUrl above. */
  companyLogoUrl?: string;
  /** shared handle text, e.g. "at-xahabcse" */
  handle?: string;
}

export interface UserDocument {
  _id?: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  emailVerified: boolean;
  /** incremented to invalidate all outstanding email-verification/password-reset JWTs */
  tokenVersion: number;
  /**
   * Incremented ONLY on a successful password reset, to revoke live session
   * cookies. Deliberately NOT the same counter as `tokenVersion`: that one is
   * bumped by the UNAUTHENTICATED /forgot-password and /resend-verification
   * routes, so using it as the session gate let anyone who merely knew a
   * victim's email address force-log-out that account on demand. Stays
   * optional on the type (the column is NOT NULL DEFAULT 0) so callers keep
   * treating a missing value as 0.
   */
  sessionVersion?: number;
  createdAt: Date;
  updatedAt: Date;
  profile: UserProfile;
  lastLoginAt?: Date;
}

export type UserRecord = Omit<UserDocument, "_id"> & { _id: string };

export type NewUserInput = Omit<UserDocument, "_id">;
// Profile writes use the field-level patchUserProfile helper so concurrent
// text/image requests cannot overwrite each other's columns.
export type UserUpdateInput = Partial<Omit<UserDocument, "_id" | "profile">>;

// ---------------------------------------------------------------------------
// `auth_events` table. Best-effort audit trail of auth-flow events
// (signup/login/reset/verify), shown in the admin; Cleanup clears old rows.
// ---------------------------------------------------------------------------

export type AuthEventType =
  | "signup"
  | "login"
  | "login_failed"
  | "reset_request"
  | "reset_complete"
  | "email_verified"
  | "admin_delete_user"
  | "admin_restore_user"
  | "admin_purge_user";

export interface AuthEventDocument {
  /** autoincrement rowid; never surfaced through the API */
  _id?: number;
  /** epoch milliseconds (Date.now()) */
  ts: number;
  type: AuthEventType;
  email: string | null;
  ip: string | null;
  detail: string | null;
}

export type NewAuthEventInput = Omit<AuthEventDocument, "_id">;
export type AuthEventRecord = Omit<AuthEventDocument, "_id">;
