import { jsonValidator } from "../lib/validation";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { isUploadedFile } from "../lib/http";
import {
  profileImageKey,
  profileImageRoute,
  toProfileResponse,
  uploadToR2,
  type ProfileImageField,
} from "../lib/storage";
import { findUserById, patchUserProfile } from "../lib/db";
import { authRequired } from "../middleware/auth-required";
import { emailVerifiedRequired } from "../middleware/email-verified-required";
import { checkAndRecordRateLimit } from "../middleware/rate-limit";
import type { UserProfile } from "../schema";

const profile = new Hono<AppEnv>();
profile.use("*", authRequired, emailVerifiedRequired);

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
// Modest per-user upload throttle so a verified account can't churn unlimited
// 5MB objects into R2 storage. Best-effort (see rate-limit.ts caveat).
const UPLOAD_MAX_PER_HOUR = 20;
// Multipart framing (boundary lines + part headers) around a MAX_UPLOAD_BYTES
// payload -- slack for the Content-Length precheck below.
const MULTIPART_OVERHEAD_BYTES = 8 * 1024;
// PUT /api/profile is a D1 read+write on the same database every authenticated
// request already reads for its session check -- so an account spamming profile
// writes eats shared database budget, not just its own. Generous enough that no
// human editing a profile will ever see it.
const PROFILE_WRITE_MAX_PER_HOUR = 60;

// Magic-byte (content) validation -- `file.type` from the multipart part is
// client-controlled, so the MIME allow-list alone is spoofable. Sniff the
// leading bytes to confirm the payload really is one of the accepted image
// formats before it reaches R2.
function sniffImageType(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) { // "WEBP"
    return "image/webp";
  }
  return null;
}

// Flat shape -- matches app/src/pages/ProfileSettingsPage.tsx's
// `.then(setProfile)` (no `{ profile }` wrapper).
profile.get("/", async (c) => {
  const user = await findUserById(c.env.DB, c.get("userId"));
  if (!user) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json(toProfileResponse(user.profile));
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  designation: z.string().trim().min(1).max(160).optional(),
  companyName: z.string().trim().max(160).optional(),
  handle: z.string().trim().min(1).max(60).optional(),
});

profile.put("/", jsonValidator(updateProfileSchema), async (c) => {
  const userId = c.get("userId");

  const rate = await checkAndRecordRateLimit(c.env.RATE_LIMIT_KV, "profile-write", userId, {
    cooldownSeconds: 0,
    maxAttempts: PROFILE_WRITE_MAX_PER_HOUR,
    windowSeconds: 60 * 60,
  });
  if (!rate.allowed) {
    return c.json({ error: "RATE_LIMITED", retryAfterSeconds: rate.retryAfterSeconds }, 429);
  }

  const updates = c.req.valid("json");

  const user = await findUserById(c.env.DB, userId);
  if (!user) return c.json({ error: "NOT_FOUND" }, 404);

  await patchUserProfile(c.env.DB, userId, updates);
  const current = await findUserById(c.env.DB, userId);
  if (!current) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json(toProfileResponse(current.profile));
});

async function handleImageUpload(c: Context<AppEnv>, field: ProfileImageField): Promise<Response> {
  const userId = c.get("userId");

  const rate = await checkAndRecordRateLimit(c.env.RATE_LIMIT_KV, "profile-upload", userId, {
    cooldownSeconds: 0,
    maxAttempts: UPLOAD_MAX_PER_HOUR,
    windowSeconds: 60 * 60,
  });
  if (!rate.allowed) {
    return c.json({ error: "RATE_LIMITED", retryAfterSeconds: rate.retryAfterSeconds }, 429);
  }

  // Reject oversized bodies BEFORE c.req.formData(), which buffers the whole
  // request into memory -- the file.size check further down only runs once that
  // has already happened, so on its own it does nothing to stop a multi-hundred
  // -MB body from being materialized. Content-Length can be absent on a chunked
  // request, hence this is a cheap first line of defence layered on top of the
  // file.size check, not a replacement for it.
  const declaredLength = Number(c.req.header("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return c.json({ error: "FILE_TOO_LARGE" }, 400);
  }

  const form = await c.req.formData();
  const file = form.get("file");
  if (!isUploadedFile(file)) {
    return c.json({ error: "FILE_REQUIRED" }, 400);
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return c.json({ error: "UNSUPPORTED_FILE_TYPE" }, 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: "FILE_TOO_LARGE" }, 400);
  }

  // Confirm the bytes actually match a permitted image format (magic bytes),
  // not just the client-supplied Content-Type. Blob.arrayBuffer() is
  // re-readable, so `file` can still be streamed to R2 afterward. The
  // `as Blob` cast sidesteps the workers-types FormData#get union (see
  // lib/http.ts) that otherwise collapses `.slice` to String.prototype.slice.
  const head = new Uint8Array(await (file as unknown as Blob).slice(0, 12).arrayBuffer());
  const sniffed = sniffImageType(head);
  if (!sniffed || !ALLOWED_IMAGE_TYPES.has(sniffed)) {
    return c.json({ error: "UNSUPPORTED_FILE_TYPE" }, 400);
  }

  const user = await findUserById(c.env.DB, userId);
  if (!user) return c.json({ error: "NOT_FOUND" }, 404);

  const key = profileImageKey(field, userId);
  await uploadToR2(c.env.PROFILE_IMAGES, key, file);

  // The R2 key is what gets stored; clients only ever see the route below.
  const imagePatch: UserProfile = field === "photoUrl" ? { photoUrl: key } : { companyLogoUrl: key };
  const saved = await patchUserProfile(c.env.DB, userId, imagePatch);
  if (!saved) {
    await c.env.PROFILE_IMAGES.delete(key);
    return c.json({ error: "NOT_FOUND" }, 404);
  }
  const current = await findUserById(c.env.DB, userId);
  if (!current) return c.json({ error: "NOT_FOUND" }, 404);

  // A versioned URL makes the existing <img> reload immediately after a
  // replacement; the authenticated serving route ignores the query string.
  const url = `${profileImageRoute(field)}?v=${Date.now()}`;
  return c.json({ url, profile: toProfileResponse(current.profile) });
}

profile.post("/photo", (c) => handleImageUpload(c, "photoUrl"));
profile.post("/logo", (c) => handleImageUpload(c, "companyLogoUrl"));

// Inline display only (the profile form's preview and the editor footer's <img>
// source). Bytes are streamed straight out of the private R2 bucket after an
// ownership check -- the bucket is never public and no object URL is exposed.
async function handleImageServe(c: Context<AppEnv>, field: ProfileImageField): Promise<Response> {
  const user = await findUserById(c.env.DB, c.get("userId"));
  const key = user?.profile[field];
  if (!key) return c.json({ error: "NOT_FOUND" }, 404);

  const object = await c.env.PROFILE_IMAGES.get(key);
  if (!object) return c.json({ error: "NOT_FOUND" }, 404);

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      // The path is identical for every account and every replacement. A
      // browser cache must never serve another user's or an older image.
      "Cache-Control": "private, no-store",
      ETag: object.httpEtag,
    },
  });
}

profile.get("/photo", (c) => handleImageServe(c, "photoUrl"));
profile.get("/logo", (c) => handleImageServe(c, "companyLogoUrl"));

export default profile;
