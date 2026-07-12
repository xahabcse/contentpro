import { jsonValidator } from "../lib/validation";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv, Env } from "../env";
import { isUploadedFile } from "../lib/http";
import {
  signCloudinaryUrlOrOriginal,
  signProfileImageUrls,
  uploadToCloudinary,
} from "../lib/cloudinary";
import { authRequired } from "../middleware/auth-required";
import { emailVerifiedRequired } from "../middleware/email-verified-required";
import { checkAndRecordRateLimit } from "../middleware/rate-limit";
import type { UserProfile } from "../schema";

const profile = new Hono<AppEnv>();
profile.use("*", authRequired, emailVerifiedRequired);

function mongoStub(env: Env) {
  const id = env.MONGO_DO.idFromName("global-mongo-connection");
  return env.MONGO_DO.get(id);
}

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
// Modest per-user upload throttle so a verified account can't churn unlimited
// 5MB objects into Cloudinary storage. Best-effort (see rate-limit.ts caveat).
const UPLOAD_MAX_PER_HOUR = 20;

// Magic-byte (content) validation -- `file.type` from the multipart part is
// client-controlled, so the MIME allow-list alone is spoofable. Sniff the
// leading bytes to confirm the payload really is one of the accepted image
// formats before it reaches Cloudinary.
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

async function signedProfile(env: Env, profile: UserProfile) {
  return signProfileImageUrls(profile, env.CLOUDINARY_API_SECRET, env.CLOUDINARY_CLOUD_NAME);
}

// Flat shape -- matches app/src/pages/ProfileSettingsPage.tsx's
// `.then(setProfile)` (no `{ profile }` wrapper).
profile.get("/", async (c) => {
  const stub = mongoStub(c.env);
  const user = await stub.findUserById(c.get("userId"));
  if (!user) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json(await signedProfile(c.env, user.profile));
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  designation: z.string().trim().min(1).max(160).optional(),
  companyName: z.string().trim().max(160).optional(),
  handle: z.string().trim().min(1).max(60).optional(),
});

profile.put("/", jsonValidator(updateProfileSchema), async (c) => {
  const updates = c.req.valid("json");
  const userId = c.get("userId");
  const stub = mongoStub(c.env);

  const user = await stub.findUserById(userId);
  if (!user) return c.json({ error: "NOT_FOUND" }, 404);

  const nextProfile: UserProfile = { ...user.profile, ...updates };
  await stub.updateUser(userId, { profile: nextProfile, updatedAt: new Date() });
  return c.json(await signedProfile(c.env, nextProfile));
});

type ProfileImageField = "photoUrl" | "companyLogoUrl";

async function handleImageUpload(
  c: Context<AppEnv>,
  field: ProfileImageField,
  cloudinaryFolder: string,
): Promise<Response> {
  const userId = c.get("userId");

  const rate = await checkAndRecordRateLimit(c.env.RATE_LIMIT_KV, "profile-upload", userId, {
    cooldownSeconds: 0,
    maxAttempts: UPLOAD_MAX_PER_HOUR,
    windowSeconds: 60 * 60,
  });
  if (!rate.allowed) {
    return c.json({ error: "RATE_LIMITED", retryAfterSeconds: rate.retryAfterSeconds }, 429);
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
  // re-readable, so `file` can still be streamed to Cloudinary afterward. The
  // `as Blob` cast sidesteps the workers-types FormData#get union (see
  // lib/http.ts) that otherwise collapses `.slice` to String.prototype.slice.
  const head = new Uint8Array(await (file as unknown as Blob).slice(0, 12).arrayBuffer());
  const sniffed = sniffImageType(head);
  if (!sniffed || !ALLOWED_IMAGE_TYPES.has(sniffed)) {
    return c.json({ error: "UNSUPPORTED_FILE_TYPE" }, 400);
  }

  const stub = mongoStub(c.env);
  const user = await stub.findUserById(userId);
  if (!user) return c.json({ error: "NOT_FOUND" }, 404);

  const url = await uploadToCloudinary(c.env, file, `${cloudinaryFolder}/${userId}`);

  const nextProfile: UserProfile = { ...user.profile, [field]: url };
  await stub.updateUser(userId, { profile: nextProfile, updatedAt: new Date() });

  // Top-level `url` -- matches ProfileSettingsPage.tsx's `const { url } = await res.json()`.
  const signed = await signCloudinaryUrlOrOriginal(url, c.env.CLOUDINARY_API_SECRET, c.env.CLOUDINARY_CLOUD_NAME);
  return c.json({ url: signed, profile: await signedProfile(c.env, nextProfile) });
}

profile.post("/photo", (c) => handleImageUpload(c, "photoUrl", "contentpro/profiles/photo"));
profile.post("/logo", (c) => handleImageUpload(c, "companyLogoUrl", "contentpro/profiles/logo"));

// Inline display only (used as the editor footer's <img> source) -- redirects
// to a signed Cloudinary delivery URL after an ownership check, rather than
// streaming bytes through the Worker (see lib/cloudinary.ts for the access
// model this relies on).
async function handleImageRedirect(c: Context<AppEnv>, field: ProfileImageField): Promise<Response> {
  const stub = mongoStub(c.env);
  const user = await stub.findUserById(c.get("userId"));
  const url = user?.profile[field];
  if (!user || !url) return c.json({ error: "NOT_FOUND" }, 404);

  const signed = await signCloudinaryUrlOrOriginal(url, c.env.CLOUDINARY_API_SECRET, c.env.CLOUDINARY_CLOUD_NAME);
  return c.redirect(signed, 302);
}

profile.get("/photo", (c) => handleImageRedirect(c, "photoUrl"));
profile.get("/logo", (c) => handleImageRedirect(c, "companyLogoUrl"));

export default profile;
