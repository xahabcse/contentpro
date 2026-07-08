// Cloudinary storage (spec section 5.6, revised) -- replaces the original R2
// design. Signed upload + signed delivery URLs, ported to match protfolio's
// exact scheme (lib/cloudinaryDelivery.ts + routes/files.ts): fetch-based,
// crypto.subtle-signed, no Cloudinary SDK.
//
// Access model: uploads use access_mode "public" (same as protfolio), so the
// underlying asset is reachable by anyone holding the URL -- delivery-URL
// signing here mirrors cloudinary_npm's sign_url logic but does not itself
// gate access (Cloudinary only enforces signatures for "authenticated"
// delivery type). The real authorization boundary is unchanged from the R2
// design: every route below still ownership-checks the Mongo document before
// ever handing back a Cloudinary URL.

import type { Env } from "../env";

// ---------------------------------------------------------------------------
// upload
// ---------------------------------------------------------------------------

async function buildCloudinarySignature(
  params: Record<string, string>,
  apiSecret: string,
): Promise<string> {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");

  const data = new TextEncoder().encode(`${sorted}${apiSecret}`);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Signed upload via fetch (no Cloudinary SDK) -- returns the plain secure_url. */
export async function uploadToCloudinary(env: Env, file: File, folder: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const resourceType = isImage ? "image" : isVideo ? "video" : "raw";

  const signParams: Record<string, string> = {
    folder,
    timestamp,
    access_mode: "public",
    exif: "false",
  };
  const signature = await buildCloudinarySignature(signParams, env.CLOUDINARY_API_SECRET);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", env.CLOUDINARY_API_KEY);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);
  formData.append("folder", folder);
  formData.append("access_mode", "public");
  formData.append("exif", "false");

  const response = await fetch(uploadUrl, { method: "POST", body: formData });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cloudinary upload failed: ${err}`);
  }

  const result = await response.json<{ secure_url: string }>();
  return result.secure_url;
}

// ---------------------------------------------------------------------------
// signed delivery URLs -- ported verbatim from protfolio's
// lib/cloudinaryDelivery.ts (matches cloudinary_npm's url() sign_url logic)
// ---------------------------------------------------------------------------

function finalizeSourceToSign(publicIdPath: string): string {
  let source = publicIdPath.replace(/([^:])\/\//g, "$1/");
  source = encodeURIComponent(decodeURIComponent(source)).replace(/%3A/g, ":").replace(/%2F/g, "/");
  return source;
}

async function digestToBase64(input: string, algorithm: "SHA-1" | "SHA-256"): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const bytes = new Uint8Array(hashBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export type CloudinaryDeliveryType = "upload" | "authenticated" | "private";

export type ParsedResCloudinaryUrl = {
  cloudName: string;
  resourceType: string;
  deliveryType: CloudinaryDeliveryType;
  transformation: string;
  version: string | null;
  publicIdPath: string;
};

/** Parse res.cloudinary.com delivery URLs (with or without version segment). */
export function parseResCloudinaryUrl(
  urlStr: string,
  expectedCloudName: string | undefined,
): ParsedResCloudinaryUrl | null {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    return null;
  }

  if (u.hostname !== "res.cloudinary.com") return null;

  const parts = u.pathname.split("/").filter((p) => p.length > 0);
  if (parts.length < 4) return null;

  const cloudName = parts[0]!;
  if (expectedCloudName != null && expectedCloudName !== "" && cloudName !== expectedCloudName) {
    return null;
  }

  const resourceType = parts[1]!;
  const deliveryType = parts[2]! as CloudinaryDeliveryType;
  if (deliveryType !== "upload" && deliveryType !== "authenticated" && deliveryType !== "private") {
    return null;
  }

  let idx = 3;
  if (parts[idx]?.startsWith("s--") === true) idx++;

  const transSegs: string[] = [];
  while (idx < parts.length) {
    const seg = parts[idx]!;
    if (/^v\d+$/.test(seg) === true) break;
    transSegs.push(seg);
    idx++;
  }

  let version: string | null = null;
  let publicParts: string[];
  if (idx < parts.length && /^v\d+$/.test(parts[idx]!) === true) {
    version = parts[idx]!;
    publicParts = parts.slice(idx + 1);
  } else {
    publicParts = parts.slice(idx);
  }

  if (publicParts.length === 0) return null;

  return {
    cloudName,
    resourceType,
    deliveryType,
    transformation: transSegs.join("/"),
    version,
    publicIdPath: publicParts.join("/"),
  };
}

function buildSignedUrlFromParsed(parsed: ParsedResCloudinaryUrl, truncatedSig: string): string {
  const pieces = [
    `https://res.cloudinary.com/${parsed.cloudName}/${parsed.resourceType}/${parsed.deliveryType}`,
    `s--${truncatedSig}--`,
    parsed.transformation,
    parsed.version,
    parsed.publicIdPath,
  ].filter((p) => p !== null && p !== "");
  return pieces.join("/");
}

export async function signCloudinaryDeliveryUrl(
  secureUrl: string,
  apiSecret: string | undefined,
  cloudName: string | undefined,
  options?: { longUrlSignature?: boolean },
): Promise<string | null> {
  if (apiSecret == null || apiSecret === "" || cloudName == null || cloudName === "") return null;
  if (secureUrl == null || secureUrl === "") return null;

  const parsed = parseResCloudinaryUrl(secureUrl, cloudName);
  if (parsed == null) return null;

  const sourceToSign = finalizeSourceToSign(parsed.publicIdPath);
  const toSign =
    parsed.transformation !== "" ? `${parsed.transformation}/${sourceToSign}` : sourceToSign;

  const longSig = options?.longUrlSignature === true;
  const digestB64 = await digestToBase64(toSign + apiSecret, longSig ? "SHA-256" : "SHA-1");
  const sigLen = longSig ? 32 : 8;
  const truncated = digestB64.slice(0, sigLen).replace(/\//g, "_").replace(/\+/g, "-");

  return buildSignedUrlFromParsed(parsed, truncated);
}

/** Convenience: always returns a string (original URL if signing is not possible). */
export async function signCloudinaryUrlOrOriginal(
  url: string,
  apiSecret: string | undefined,
  cloudName: string | undefined,
  options?: { longUrlSignature?: boolean },
): Promise<string> {
  const signed = await signCloudinaryDeliveryUrl(url, apiSecret, cloudName, options);
  return signed != null && signed !== "" ? signed : url;
}

/**
 * Inserts Cloudinary's `fl_attachment` transformation flag so the browser
 * downloads (Save As) instead of displaying inline -- only used for the
 * design-export download route, never for profile photo/logo (those stay
 * inline, matching the original R2 behavior's `download` opt-in flag).
 */
export function withAttachmentFlag(secureUrl: string, filename: string): string {
  const safe = filename.replace(/[^\w.-]+/g, "_");
  const marker = "/upload/";
  const idx = secureUrl.indexOf(marker);
  if (idx === -1) return secureUrl;
  const insertAt = idx + marker.length;
  return `${secureUrl.slice(0, insertAt)}fl_attachment:${encodeURIComponent(safe)}/${secureUrl.slice(insertAt)}`;
}
