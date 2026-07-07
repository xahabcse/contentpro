import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv, Env } from "../env";
import { isUploadedFile } from "../lib/http";
import { getObject, objectToResponse, putObject } from "../lib/r2";
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

profile.get("/", async (c) => {
  const stub = mongoStub(c.env);
  const user = await stub.findUserById(c.get("userId"));
  if (!user) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json({ profile: user.profile });
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  designation: z.string().trim().min(1).max(160).optional(),
  companyName: z.string().trim().max(160).optional(),
  handle: z.string().trim().min(1).max(60).optional(),
});

profile.put("/", zValidator("json", updateProfileSchema), async (c) => {
  const updates = c.req.valid("json");
  const userId = c.get("userId");
  const stub = mongoStub(c.env);

  const user = await stub.findUserById(userId);
  if (!user) return c.json({ error: "NOT_FOUND" }, 404);

  const nextProfile: UserProfile = { ...user.profile, ...updates };
  await stub.updateUser(userId, { profile: nextProfile, updatedAt: new Date() });
  return c.json({ profile: nextProfile });
});

type ProfileImageField = "photoR2Key" | "companyLogoR2Key";

async function handleImageUpload(
  c: Context<AppEnv>,
  field: ProfileImageField,
  r2KeyPrefix: string,
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

  const key = `${r2KeyPrefix}/${userId}`;
  const bytes = await file.arrayBuffer();
  await putObject(c.env.FILES, key, bytes, file.type);

  const nextProfile: UserProfile = { ...user.profile, [field]: key };
  await stub.updateUser(userId, { profile: nextProfile, updatedAt: new Date() });

  return c.json({ profile: nextProfile });
}

profile.post("/photo", (c) => handleImageUpload(c, "photoR2Key", "profiles/photo"));
profile.post("/logo", (c) => handleImageUpload(c, "companyLogoR2Key", "profiles/logo"));

async function handleImageDownload(c: Context<AppEnv>, field: ProfileImageField): Promise<Response> {
  const stub = mongoStub(c.env);
  const user = await stub.findUserById(c.get("userId"));
  const key = user?.profile[field];
  if (!user || !key) return c.json({ error: "NOT_FOUND" }, 404);

  const obj = await getObject(c.env.FILES, key);
  if (!obj) return c.json({ error: "NOT_FOUND" }, 404);
  return objectToResponse(obj);
}

profile.get("/photo", (c) => handleImageDownload(c, "photoR2Key"));
profile.get("/logo", (c) => handleImageDownload(c, "companyLogoR2Key"));

export default profile;
