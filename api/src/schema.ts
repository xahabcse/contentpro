import type { ObjectId } from "mongodb";

// ---------------------------------------------------------------------------
// designs -- new template-driven model (ContentPro.dc.html redesign).
// A design is a type (card | carousel) + a shared palette + author + an
// ordered list of slides. Each slide picks one of the curated templates and
// fills that template's fields. Card = exactly one slide; carousel = many.
// ---------------------------------------------------------------------------

export type DesignType = "card" | "carousel";
export type DesignFileType = "image" | "pdf";

/** Template ids -- see app/src/lib/templates.tsx for the renderers. */
export type TemplateId =
  | "quote"
  | "stat"
  | "tips"
  | "cover"
  | "announce"
  | "question"
  | "contrast"
  | "framework"
  | "cta"
  | "statement";

/**
 * A single slide. `fields` is intentionally loose -- every template has its
 * own field set (string or string[] values), validated by shape not by exact
 * keys, so new templates never require a schema migration.
 */
export interface DesignSlide {
  template: TemplateId;
  fields: Record<string, string | string[]>;
  /** Cloudinary secure_url of an optional full-bleed background image. */
  bgImage?: string | null;
}

export interface DesignAuthor {
  name: string;
  handle: string;
  /** Cloudinary secure_url of the author avatar; null falls back to an initial. */
  avatar?: string | null;
}

export interface DesignExport {
  /** Cloudinary secure_url of the exported PNG/PDF. */
  url?: string;
  mimeType?: string;
  sizeBytes?: number;
  pageCount?: number;
  checksum?: string;
  exportedAt?: Date;
}

/** Mongo-persisted shape -- used only by the Mongo Connection Durable Object. */
export interface DesignDocument {
  _id?: ObjectId;
  userId: ObjectId;
  type: DesignType;
  title?: string;
  paletteId: string;
  /** Per-design custom color overrides (null = use the palette default). */
  customBg?: string | null;
  customText?: string | null;
  customAccent?: string | null;
  author: DesignAuthor;
  slides: DesignSlide[];
  fileType: DesignFileType;
  export?: DesignExport;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * JSON/RPC-safe shape returned across the Durable Object boundary (Workers
 * RPC's structured-clone wire format doesn't reliably round-trip ObjectId, so
 * the DO converts _id/userId to hex strings first).
 */
export type DesignRecord = Omit<DesignDocument, "_id" | "userId"> & {
  _id: string;
  userId: string;
};

export type NewDesignInput = Omit<DesignDocument, "_id" | "userId"> & { userId: string };
export type DesignUpdateInput = Partial<Omit<DesignDocument, "_id" | "userId">>;

/**
 * type deterministically fixes fileType -- card always exports a PNG/"image",
 * carousel always a PDF/"pdf". Set once at creation, immutable thereafter.
 */
export function fileTypeForType(type: DesignType): DesignFileType {
  return type === "card" ? "image" : "pdf";
}

export function mimeTypeForType(type: DesignType): string {
  return type === "card" ? "image/png" : "application/pdf";
}

// ---------------------------------------------------------------------------
// users collection -- unchanged from the auth build.
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
