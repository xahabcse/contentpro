import { jsonValidator } from "../lib/validation";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv, Env } from "../env";
import { isUploadedFile } from "../lib/http";
import { signCloudinaryUrlOrOriginal, uploadToCloudinary, withAttachmentFlag } from "../lib/cloudinary";
import { authRequired } from "../middleware/auth-required";
import { emailVerifiedRequired } from "../middleware/email-verified-required";
import {
  fileTypeForFormat,
  isValidCarouselSlides,
  mimeTypeForFormat,
  type DesignContent,
  type DesignFormat,
  type DesignStyle,
  type NewDesignInput,
  type RegionKey,
} from "../schema";

const designs = new Hono<AppEnv>();
designs.use("*", authRequired, emailVerifiedRequired);

function mongoStub(env: Env) {
  const id = env.MONGO_DO.idFromName("global-mongo-connection");
  return env.MONGO_DO.get(id);
}

const MAX_DESIGNS_PER_TYPE = 5; // spec section 7 -- 5 images / 5 PDFs per user
const MAX_CAROUSEL_SLIDES = 15; // spec section 8 -- hard cap, decision 19
const MAX_EXPORT_BYTES = 20 * 1024 * 1024; // safety ceiling for a client-rasterized PNG/PDF

// ---------------------------------------------------------------------------
// validation schemas
// ---------------------------------------------------------------------------

const regionStyleSchema = z.object({
  font: z.string().min(1),
  size: z.enum(["S", "M", "L"]),
  // Not currently sent by the frontend, which only distinguishes
  // palette-default vs customHex -- kept optional for forward compatibility.
  colorToken: z.string().min(1).optional(),
  customHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

const styleSchema = z.object({
  paletteId: z.string().min(1),
  regions: z.record(z.string(), regionStyleSchema),
});

const createDesignSchema = z.object({
  format: z.enum(["card", "carousel"]),
  title: z.string().trim().max(160).optional(),
});

const cardContentSchema = z.object({
  eyebrow: z.string().max(60).optional(),
  headline: z.string().max(300),
  body: z.array(z.string().max(2000)).max(2),
});

const carouselSlideSchema = z.object({
  type: z.enum(["cover", "content", "cta"]),
  headline: z.string().max(300).optional(),
  heading: z.string().max(300).optional(),
  bullets: z.array(z.string().max(500)).optional(),
  body: z.string().max(2000).optional(),
  cta: z.string().max(300).optional(),
});

const carouselContentSchema = z.object({
  slides: z.array(carouselSlideSchema).min(2).max(MAX_CAROUSEL_SLIDES),
});

const updateDesignSchema = z.object({
  title: z.string().trim().max(160).optional(),
  content: z.union([cardContentSchema, carouselContentSchema]),
  style: styleSchema,
});

// ---------------------------------------------------------------------------
// starter content/style for a brand-new design (spec section 4.1: "initial
// empty/starter content, default style")
// ---------------------------------------------------------------------------

const DEFAULT_FONT = "Plus Jakarta Sans"; // spec section 6.1 -- pre-selected default everywhere

function starterContent(format: DesignFormat): DesignContent {
  if (format === "card") {
    return { eyebrow: "", headline: "", body: [""] };
  }
  return {
    slides: [
      { type: "cover", headline: "" },
      { type: "cta", heading: "", body: "", cta: "" },
    ],
  };
}

const CARD_REGION_KEYS: RegionKey[] = ["eyebrow", "headline", "body", "footer"];
const CAROUSEL_REGION_KEYS: RegionKey[] = [
  "coverHeadline",
  "contentHeading",
  "contentBody",
  "ctaHeading",
  "ctaBody",
  "ctaLine",
];

function starterStyle(format: DesignFormat): DesignStyle {
  const regionKeys = format === "card" ? CARD_REGION_KEYS : CAROUSEL_REGION_KEYS;
  const regions: DesignStyle["regions"] = {};
  for (const key of regionKeys) {
    regions[key] = { font: DEFAULT_FONT, size: "M", colorToken: "text-primary" };
  }
  return { paletteId: "brand-default", regions };
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// routes
// ---------------------------------------------------------------------------

// Profile-completeness gate (spec section 4.1) -- the only enforcement point
// for requiring profile.name / profile.designation / profile.handle before a
// design can be created.
designs.post("/", jsonValidator(createDesignSchema), async (c) => {
  const { format, title } = c.req.valid("json");
  const userId = c.get("userId");
  const stub = mongoStub(c.env);

  const user = await stub.findUserById(userId);
  if (!user) return c.json({ error: "NOT_FOUND" }, 404);

  const { name, designation, handle } = user.profile;
  if (!name || !designation || !handle) {
    return c.json({ error: "PROFILE_INCOMPLETE" }, 400);
  }

  const now = new Date();
  const newDesign: NewDesignInput = {
    userId,
    format,
    title,
    content: starterContent(format),
    style: starterStyle(format),
    fileType: fileTypeForFormat(format),
    createdAt: now,
    updatedAt: now,
  };
  const id = await stub.insertDesign(newDesign);
  return c.json({ id }, 201);
});

// Dashboard/gallery listing -- includes the 5+5 usage counters (spec 4.1/7).
// Thumbnails are intentionally NOT returned here; they're a client-side
// mini-render of content/style, not a stored image (spec section 6).
// `counts` shape matches app/src/lib/api.ts's DesignCounts exactly.
designs.get("/", async (c) => {
  const userId = c.get("userId");
  const stub = mongoStub(c.env);
  const items = await stub.listDesignsForUser(userId);

  const imageCount = items.filter((d) => d.fileType === "image").length;
  const pdfCount = items.filter((d) => d.fileType === "pdf").length;

  return c.json({
    designs: items.map((d) => ({
      id: d._id,
      format: d.format,
      title: d.title,
      fileType: d.fileType,
      hasExport: Boolean(d.export?.url),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
    counts: { images: imageCount, pdfs: pdfCount },
  });
});

// Flat shape -- matches CardEditorPage.tsx/CarouselEditorPage.tsx's
// `.then((d) => { setContent(d.content); setStyle(d.style); })`, not a
// `{ design }` wrapper.
designs.get("/:id", async (c) => {
  const stub = mongoStub(c.env);
  const design = await stub.findDesign(c.req.param("id"));
  if (!design || design.userId !== c.get("userId")) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }
  if (design.export?.url) {
    const signedUrl = await signCloudinaryUrlOrOriginal(
      design.export.url,
      c.env.CLOUDINARY_API_SECRET,
      c.env.CLOUDINARY_CLOUD_NAME,
    );
    return c.json({ ...design, export: { ...design.export, url: signedUrl } });
  }
  return c.json(design);
});

// Autosaved by the editor (debounced ~2s + on-blur/pre-download, spec 4.1) --
// overwrites content/style in place, no draft/export split (decision 10).
designs.put("/:id", jsonValidator(updateDesignSchema), async (c) => {
  const { title, content, style } = c.req.valid("json");
  const stub = mongoStub(c.env);
  const design = await stub.findDesign(c.req.param("id"));
  if (!design || design.userId !== c.get("userId")) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }

  const isCarouselShaped = "slides" in content;
  if (design.format === "carousel" && !isCarouselShaped) {
    return c.json({ error: "CONTENT_FORMAT_MISMATCH" }, 400);
  }
  if (design.format === "card" && isCarouselShaped) {
    return c.json({ error: "CONTENT_FORMAT_MISMATCH" }, 400);
  }
  if (isCarouselShaped && !isValidCarouselSlides(content.slides)) {
    return c.json({ error: "INVALID_SLIDE_STRUCTURE" }, 400);
  }

  await stub.updateDesign(design._id, {
    ...(title !== undefined ? { title } : {}),
    content,
    style,
    updatedAt: new Date(),
  });

  return c.json({ message: "Saved." });
});

// Deletes the design document, freeing one slot against the 5/5 cap
// (decision 10). Does NOT also destroy the underlying Cloudinary asset --
// matches protfolio's own files.ts, which never calls Cloudinary's destroy
// API on delete either (soft-delete of the DB record only). An orphaned
// Cloudinary asset is an acceptable v1 tradeoff for this parity.
designs.delete("/:id", async (c) => {
  const stub = mongoStub(c.env);
  const design = await stub.findDesign(c.req.param("id"));
  if (!design || design.userId !== c.get("userId")) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }

  await stub.deleteDesign(design._id);
  return c.json({ message: "Deleted." });
});

// Explicit "save as new" (spec 4.1/7) -- creates a new document, no export yet.
designs.post("/:id/duplicate", async (c) => {
  const stub = mongoStub(c.env);
  const source = await stub.findDesign(c.req.param("id"));
  if (!source || source.userId !== c.get("userId")) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }

  const now = new Date();
  const newDesign: NewDesignInput = {
    userId: source.userId,
    format: source.format,
    title: source.title ? `${source.title} (copy)` : undefined,
    content: source.content,
    style: source.style,
    fileType: source.fileType,
    createdAt: now,
    updatedAt: now,
  };
  const id = await stub.insertDesign(newDesign);
  return c.json({ id }, 201);
});

// Accepts the client-rendered PNG/PDF binary (multipart form, field "file"),
// checks the 5/5 cap (unless this design already has an export -- re-exports
// overwrite in place and never count against the cap, spec section 7),
// uploads it to Cloudinary, and writes export.* metadata. Each re-export
// creates a fresh Cloudinary asset (a new public_id/URL each time, same as
// protfolio's /upload) rather than overwriting one in place -- the prior
// asset is simply orphaned, matching the delete route's same tradeoff.
designs.post("/:id/export", async (c) => {
  const stub = mongoStub(c.env);
  const design = await stub.findDesign(c.req.param("id"));
  if (!design || design.userId !== c.get("userId")) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }

  const isReExport = Boolean(design.export?.url);
  if (!isReExport) {
    const count = await stub.countDesignsByType(design.userId, design.fileType);
    if (count >= MAX_DESIGNS_PER_TYPE) {
      return c.json(
        { error: "LIMIT_REACHED", fileType: design.fileType, limit: MAX_DESIGNS_PER_TYPE },
        409,
      );
    }
  }

  const form = await c.req.formData();
  const file = form.get("file");
  if (!isUploadedFile(file)) {
    return c.json({ error: "FILE_REQUIRED" }, 400);
  }
  if (file.size > MAX_EXPORT_BYTES) {
    return c.json({ error: "FILE_TOO_LARGE" }, 400);
  }

  const expectedMime = mimeTypeForFormat(design.format);
  if (file.type && file.type !== expectedMime) {
    return c.json({ error: "UNSUPPORTED_FILE_TYPE", expected: expectedMime }, 400);
  }

  const pageCountRaw = form.get("pageCount");
  const pageCount =
    design.format === "carousel" && typeof pageCountRaw === "string"
      ? Number.parseInt(pageCountRaw, 10)
      : undefined;

  const bytes = await file.arrayBuffer();
  const checksum = await sha256Hex(bytes);
  const url = await uploadToCloudinary(c.env, file, `contentpro/designs/${design.userId}`);

  await stub.updateDesign(design._id, {
    export: {
      url,
      mimeType: expectedMime,
      sizeBytes: bytes.byteLength,
      pageCount,
      checksum,
      exportedAt: new Date(),
    },
    updatedAt: new Date(),
  });

  return c.json({ message: "Exported.", sizeBytes: bytes.byteLength });
});

// Not currently linked from any UI affordance (the editor downloads its
// client-rendered blob directly, see app/src/lib/export.ts) -- kept as the
// ownership-checked API surface for a future "re-download" action (decision
// 12: exported files are only ever retrieved through an authenticated,
// ownership-checked path). Redirects to a signed Cloudinary URL with
// fl_attachment forcing a real "Save As" download, rather than streaming
// bytes through the Worker.
designs.get("/:id/download", async (c) => {
  const stub = mongoStub(c.env);
  const design = await stub.findDesign(c.req.param("id"));
  if (!design || design.userId !== c.get("userId")) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }
  if (!design.export?.url) {
    return c.json({ error: "NOT_EXPORTED" }, 404);
  }

  const extension = design.fileType === "image" ? "png" : "pdf";
  const filename = `${design.title ?? "design"}.${extension}`;
  const attachmentUrl = withAttachmentFlag(design.export.url, filename);
  const signed = await signCloudinaryUrlOrOriginal(
    attachmentUrl,
    c.env.CLOUDINARY_API_SECRET,
    c.env.CLOUDINARY_CLOUD_NAME,
  );
  return c.redirect(signed, 302);
});

export default designs;
