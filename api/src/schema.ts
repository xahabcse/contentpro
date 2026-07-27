import type { ObjectId } from "mongodb";

// ---------------------------------------------------------------------------
// users collection. Designs are browser-only (localStorage + IndexedDB) and
// no longer persisted server-side, so the only Mongo collection is `users`.
// ---------------------------------------------------------------------------

export interface UserProfile {
  name?: string;
  designation?: string;
  /** Cloudinary secure_url. */
  photoUrl?: string;
  companyName?: string;
  /** Cloudinary secure_url. */
  companyLogoUrl?: string;
  /** shared handle text, e.g. "at-xahabcse" */
  handle?: string;
}

export interface UserDocument {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  emailVerified: boolean;
  /** incremented to invalidate all outstanding email-verification/password-reset JWTs */
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
  profile: UserProfile;
  lastLoginAt?: Date;
}

export type UserRecord = Omit<UserDocument, "_id"> & { _id: string };

export type NewUserInput = Omit<UserDocument, "_id">;
export type UserUpdateInput = Partial<Omit<UserDocument, "_id">>;

// ---------------------------------------------------------------------------
// auth_events collection. Best-effort audit trail of auth-flow events
// (signup/login/reset/verify), surfaced read-only through the admin API.
// ---------------------------------------------------------------------------

export type AuthEventType =
  | "signup"
  | "login"
  | "login_failed"
  | "reset_request"
  | "reset_complete"
  | "email_verified";

export interface AuthEventDocument {
  _id?: ObjectId;
  /** epoch milliseconds (Date.now()) */
  ts: number;
  type: AuthEventType;
  email: string | null;
  ip: string | null;
  detail: string | null;
}

export type NewAuthEventInput = Omit<AuthEventDocument, "_id">;
export type AuthEventRecord = Omit<AuthEventDocument, "_id">;
