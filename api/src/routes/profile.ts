import { jsonValidator } from "../lib/validation";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv, Env } from "../env";
import { buildDemoDesigns } from "../lib/demo-designs";
import { isUploadedFile } from "../lib/http";
import { signCloudinaryUrlOrOriginal, uploadToCloudinary } from "../lib/cloudinary";
import { authRequired } from "../middleware/auth-required";
import { emailVerifiedRequired } from "../middleware/email-verified-required";
import type { UserProfile } from "../schema";

const profile = new Hono<AppEnv>();
profile.use("*", authRequired, emailVerifiedRequired);

function mongoStub(env: Env) {
  const id = env.MONGO_DO.idFromName("global-mongo-connection");
  return env.MONGO_DO.get(id);
}

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

// Every URL handed back to the client is signed here (matches protfolio's
// files.ts, which signs on every route that returns a stored URL, not just a
// dedicated redirect endpoint). Storage keeps the plain secure_url; signing
// happens only at response time.
async function signedProfile(env: Env, profile: UserProfile) {
  const [photoUrl, companyLogoUrl] = await Promise.all([
    profile.photoUrl
      ? signCloudinaryUrlOrOriginal(profile.photoUrl, env.CLOUDINARY_API_SECRET, env.CLOUDINARY_CLOUD_NAME)
      : null,
    profile.companyLogoUrl
      ? signCloudinaryUrlOrOriginal(profile.companyLogoUrl, env.CLOUDINARY_API_SECRET, env.CLOUDINARY_CLOUD_NAME)
      : null,
  ]);
  return { ...profile, photoUrl, companyLogoUrl };
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

function isProfileComplete(p: UserProfile): boolean {
  return Boolean(p.name && p.designation && p.handle);
}

profile.put("/", jsonValidator(updateProfileSchema), async (c) => {
  const updates = c.req.valid("json");
  const userId = c.get("userId");
  const stub = mongoStub(c.env);

  const user = await stub.findUserById(userId);
  if (!user) return c.json({ error: "NOT_FOUND" }, 404);

  const wasComplete = isProfileComplete(user.profile);
  const nextProfile: UserProfile = { ...user.profile, ...updates };
  await stub.updateUser(userId, { profile: nextProfile, updatedAt: new Date() });

  // First time the profile becomes complete -- seed two ready example
  // designs so the dashboard isn't empty. The author is snapshotted from the
  // just-completed profile (name/handle/photo), matching the design model.
  if (!wasComplete && isProfileComplete(nextProfile)) {
    const existing = await stub.listDesignsForUser(userId);
    if (existing.length === 0) {
      const author = {
        name: nextProfile.name || "Your Name",
        handle: nextProfile.handle || "yourhandle",
        avatar: nextProfile.photoUrl || null,
      };
      for (const demo of buildDemoDesigns(userId, author)) {
        await stub.insertDesign(demo);
      }
    }
  }

  return c.json(await signedProfile(c.env, nextProfile));
});

type ProfileImageField = "photoUrl" | "companyLogoUrl";

async function handleImageUpload(
  c: Context<AppEnv>,
  field: ProfileImageField,
  cloudinaryFolder: string,
): Promise<Response> {
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

  const userId = c.get("userId");
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
