import { Hono } from "hono";
import { z } from "zod";
import { jsonValidator } from "../lib/validation";
import type { AppEnv, Env } from "../env";
import { isUploadedFile } from "../lib/http";
import { signCloudinaryUrlOrOriginal, uploadToCloudinary, withAttachmentFlag } from "../lib/cloudinary";
import { starterSlides } from "../lib/starter";
import { authRequired } from "../middleware/auth-required";
import { emailVerifiedRequired } from "../middleware/email-verified-required";
import {
  fileTypeForType,
  mimeTypeForType,
  type DesignAuthor,
  type DesignSlide,
  type DesignType,
  type NewDesignInput,
} from "../schema";

const designs = new Hono<AppEnv>();
designs.use("*", authRequired, emailVerifiedRequired);

function mongoStub(env: Env) {
  const id = env.MONGO_DO.idFromName("global-mongo-connection");
  return env.MONGO_DO.get(id);
}

const MAX_DESIGNS_PER_TYPE = 5; // 5 images / 5 PDFs per user
const MAX_SLIDES = 15; // carousel hard cap
const MAX_EXPORT_BYTES = 100 * 1024 * 1024;

// ---------------------------------------------------------------------------
// validation -- fields are intentionally loose (each template owns its keys).
// ---------------------------------------------------------------------------

const fieldValueSchema = z.union([z.string().max(4000), z.array(z.string().max(2000)).max(30)]);

const slideSchema = z.object({
  template: z.string().min(1).max(40),
  fields: z.record(z.string(), fieldValueSchema),
  bgImage: z.string().url().nullable().optional(),
});

const authorSchema = z.object({
  name: z.string().trim().max(120),
  handle: z.string().trim().max(60),
  avatar: z.string().url().nullable().optional(),
});

const hexOrNull = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .nullable()
  .optional();

const createDesignSchema = z.object({
  type: z.enum(["card", "carousel"]),
  title: z.string().trim().max(160).optional(),
});

const updateDesignSchema = z.object({
  title: z.string().trim().max(160).optional(),
  paletteId: z.string().min(1).max(40),
  customBg: hexOrNull,
  customText: hexOrNull,
  customAccent: hexOrNull,
  author: authorSchema,
  slides: z.array(slideSchema).min(1).max(MAX_SLIDES),
});

// ---------------------------------------------------------------------------
// routes
// ---------------------------------------------------------------------------

designs.post("/", jsonValidator(createDesignSchema), async (c) => {
  const { type, title } = c.req.valid("json");
  const userId = c.get("userId");
  const stub = mongoStub(c.env);

  const user = await stub.findUserById(userId);
  if (!user) return c.json({ error: "NOT_FOUND" }, 404);

  // Prefill the author from the profile if available; inline-editable later.
  const profile = user.profile;
  const author: DesignAuthor = {
    name: profile.name || "Your Name",
    handle: profile.handle || "yourhandle",
    avatar: profile.photoUrl || null,
  };

  const now = new Date();
  const newDesign: NewDesignInput = {
    userId,
    type: type as DesignType,
    title,
    paletteId: type === "card" ? "bone" : "ink",
    customBg: null,
    customText: null,
    customAccent: null,
    author,
    slides: starterSlides(type as DesignType),
    fileType: fileTypeForType(type as DesignType),
    createdAt: now,
    updatedAt: now,
  };
  const id = await stub.insertDesign(newDesign);
  return c.json({ id }, 201);
});

// Dashboard listing + 5/5 usage counters. Thumbnails are a client-side
// mini-render of the design, not stored images.
designs.get("/", async (c) => {
  const userId = c.get("userId");
  const stub = mongoStub(c.env);
  const items = await stub.listDesignsForUser(userId);

  const imageCount = items.filter((d) => d.fileType === "image").length;
  const pdfCount = items.filter((d) => d.fileType === "pdf").length;

  return c.json({
    designs: items.map((d) => ({
      id: d._id,
      type: d.type,
      title: d.title,
      fileType: d.fileType,
      paletteId: d.paletteId,
      slideCount: d.slides.length,
      hasExport: Boolean(d.export?.url),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
    counts: { images: imageCount, pdfs: pdfCount },
  });
});

// Flat shape -- the editor reads d.type/d.slides/d.author/d.paletteId directly.
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

// Autosaved by the editor (debounced) -- overwrites in place.
designs.put("/:id", jsonValidator(updateDesignSchema), async (c) => {
  const { title, paletteId, customBg, customText, customAccent, author, slides } = c.req.valid("json");
  const stub = mongoStub(c.env);
  const design = await stub.findDesign(c.req.param("id"));
  if (!design || design.userId !== c.get("userId")) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }

  // A card is always exactly one slide.
  if (design.type === "card" && slides.length !== 1) {
    return c.json({ error: "CARD_MUST_HAVE_ONE_SLIDE" }, 400);
  }

  await stub.updateDesign(design._id, {
    ...(title !== undefined ? { title } : {}),
    paletteId,
    customBg: customBg ?? null,
    customText: customText ?? null,
    customAccent: customAccent ?? null,
    author,
    // template is validated as a loose string; the editor only ever sends
    // known TemplateId values, so this narrowing cast is safe.
    slides: slides as DesignSlide[],
    updatedAt: new Date(),
  });

  return c.json({ message: "Saved." });
});

designs.delete("/:id", async (c) => {
  const stub = mongoStub(c.env);
  const design = await stub.findDesign(c.req.param("id"));
  if (!design || design.userId !== c.get("userId")) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }
  await stub.deleteDesign(design._id);
  return c.json({ message: "Deleted." });
});

designs.post("/:id/duplicate", async (c) => {
  const stub = mongoStub(c.env);
  const source = await stub.findDesign(c.req.param("id"));
  if (!source || source.userId !== c.get("userId")) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }

  const now = new Date();
  const newDesign: NewDesignInput = {
    userId: source.userId,
    type: source.type,
    title: source.title ? `${source.title} (copy)` : undefined,
    paletteId: source.paletteId,
    customBg: source.customBg ?? null,
    customText: source.customText ?? null,
    customAccent: source.customAccent ?? null,
    author: source.author,
    slides: source.slides,
    fileType: source.fileType,
    createdAt: now,
    updatedAt: now,
  };
  const id = await stub.insertDesign(newDesign);
  return c.json({ id }, 201);
});

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Accepts the client-rendered PNG/PDF, checks the 5/5 cap (unless re-export),
// uploads to Cloudinary, writes export.* metadata.
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

  const expectedMime = mimeTypeForType(design.type);
  if (file.type && file.type !== expectedMime) {
    return c.json({ error: "UNSUPPORTED_FILE_TYPE", expected: expectedMime }, 400);
  }

  const pageCountRaw = form.get("pageCount");
  const pageCount =
    design.type === "carousel" && typeof pageCountRaw === "string"
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
