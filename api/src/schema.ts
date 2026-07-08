import type { ObjectId } from "mongodb";

// ---------------------------------------------------------------------------
// style.regions -- spec section 3.2
// ---------------------------------------------------------------------------

export type RegionKey =
  | "eyebrow"
  | "headline"
  | "body"
  | "footer"
  | "coverHeadline"
  | "contentHeading"
  | "contentBody"
  | "ctaHeading"
  | "ctaBody"
  | "ctaLine";

export type RegionSize = "S" | "M" | "L";

export interface RegionStyle {
  font: string;
  size: RegionSize;
  /** Not currently sent by the frontend, which only distinguishes palette-default vs customHex. */
  colorToken?: string;
  customHex?: string;
}

export type StyleRegions = Partial<Record<RegionKey, RegionStyle>>;

export interface DesignStyle {
  paletteId: string;
  regions: StyleRegions;
}

// ---------------------------------------------------------------------------
// content -- format-specific shapes, spec section 3.2
// ---------------------------------------------------------------------------

export type DesignFormat = "card" | "carousel";
export type DesignFileType = "image" | "pdf";

export interface CardContent {
  eyebrow?: string;
  headline: string;
  body: string[];
}

export type CarouselSlideType = "cover" | "content" | "cta";

export interface CarouselSlide {
  type: CarouselSlideType;
  /** cover slide only */
  headline?: string;
  /** content / cta slides */
  heading?: string;
  /** content slides, "bullets with checkmarks" mode */
  bullets?: string[];
  /** content slides ("plain paragraph" mode) / cta slide */
  body?: string;
  /** cta slide only */
  cta?: string;
}

export interface CarouselContent {
  slides: CarouselSlide[];
}

export type DesignContent = CardContent | CarouselContent;

export function isCarouselContent(content: DesignContent): content is CarouselContent {
  return "slides" in content;
}

/**
 * Structural constraint from spec section 3.2: slide 0 is always "cover", the
 * last slide is always "cta", everything strictly between is "content". This
 * is enforced server-side on every write, not just by editor UI affordances.
 */
export function isValidCarouselSlides(slides: CarouselSlide[]): boolean {
  if (slides.length < 2) return false;
  const first = slides[0];
  const last = slides[slides.length - 1];
  if (!first || first.type !== "cover") return false;
  if (!last || last.type !== "cta") return false;
  return slides.slice(1, -1).every((slide) => slide.type === "content");
}

/**
 * format deterministically fixes fileType (spec section 3.2) -- card always
 * exports PNG/"image", carousel always exports PDF/"pdf". Set once at
 * creation and immutable thereafter; never derive this independently anywhere
 * else in the codebase.
 */
export function fileTypeForFormat(format: DesignFormat): DesignFileType {
  return format === "card" ? "image" : "pdf";
}

export function mimeTypeForFormat(format: DesignFormat): string {
  return format === "card" ? "image/png" : "application/pdf";
}

// ---------------------------------------------------------------------------
// designs collection -- spec section 3.2
// ---------------------------------------------------------------------------

export interface DesignExport {
  /** Cloudinary secure_url of the exported PNG/PDF. */
  url?: string;
  mimeType?: string;
  sizeBytes?: number;
  /** carousel PDFs only -- number of slides; n/a for card PNGs */
  pageCount?: number;
  checksum?: string;
  exportedAt?: Date;
}

/** Mongo-persisted shape -- used only by the Mongo Connection Durable Object. */
export interface DesignDocument {
  _id?: ObjectId;
  userId: ObjectId;
  format: DesignFormat;
  title?: string;
  content: DesignContent;
  style: DesignStyle;
  fileType: DesignFileType;
  export?: DesignExport;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * JSON/RPC-safe shape returned across the Durable Object boundary (Workers
 * RPC's structured-clone-based wire format does not reliably round-trip
 * driver-specific classes like ObjectId, so the DO converts _id/userId to
 * hex strings before returning -- see durable-objects/mongo-connection.ts).
 */
export type DesignRecord = Omit<DesignDocument, "_id" | "userId"> & {
  _id: string;
  userId: string;
};

export type NewDesignInput = Omit<DesignDocument, "_id" | "userId"> & { userId: string };
export type DesignUpdateInput = Partial<Omit<DesignDocument, "_id" | "userId">>;

// ---------------------------------------------------------------------------
// users collection -- spec section 3.1
// ---------------------------------------------------------------------------

export interface UserProfile {
  name?: string;
  designation?: string;
  /** Cloudinary secure_url. */
  photoUrl?: string;
  companyName?: string;
  /** Cloudinary secure_url. */
  companyLogoUrl?: string;
  /** the one shared handle text used under all 4 social icons, e.g. "at-xahabcse" */
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
