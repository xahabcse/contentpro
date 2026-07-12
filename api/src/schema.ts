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
