import { Hono } from "hono";
import type { AppEnv } from "../env";
import { signCloudinaryUrlOrOriginal, uploadToCloudinary } from "../lib/cloudinary";
import { isUploadedFile } from "../lib/http";
import { authRequired } from "../middleware/auth-required";
import { emailVerifiedRequired } from "../middleware/email-verified-required";

// Generic authenticated image upload -- used by the editor for author avatars
// and per-slide background images (ContentPro.dc.html redesign). Returns a
// signed Cloudinary delivery URL the design then stores.

const uploads = new Hono<AppEnv>();
uploads.use("*", authRequired, emailVerifiedRequired);

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB

uploads.post("/image", async (c) => {
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
  const url = await uploadToCloudinary(c.env, file, `contentpro/editor/${userId}`);
  const signed = await signCloudinaryUrlOrOriginal(url, c.env.CLOUDINARY_API_SECRET, c.env.CLOUDINARY_CLOUD_NAME);
  return c.json({ url: signed });
});

export default uploads;
