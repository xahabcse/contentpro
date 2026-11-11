// R2 storage for profile images (spec section 5.6) -- replaces the interim
// Cloudinary integration. The bucket is private: bytes are streamed back
// through an authenticated, ownership-checked Worker route, so no object URL,
// signed or otherwise, is ever handed to a client and there is nothing to sign.

import type { UserProfile } from "../schema";

export type ProfileImageField = "photoUrl" | "companyLogoUrl";

// One object per user per field. Keys are deterministic (no timestamp, no
// folder-per-upload), so a re-upload overwrites in place and a replaced image
// never leaves an orphaned object behind.
const KEY_PREFIX: Record<ProfileImageField, string> = {
  photoUrl: "profiles/photo",
  companyLogoUrl: "profiles/logo",
};

// The fixed same-origin paths the frontend uses directly as an <img src>. The
// stored R2 key is an internal detail and is never returned to a client.
const ROUTE_PATH: Record<ProfileImageField, string> = {
  photoUrl: "/api/profile/photo",
  companyLogoUrl: "/api/profile/logo",
};

export function profileImageKey(field: ProfileImageField, userId: string): string {
  return `${KEY_PREFIX[field]}/${userId}`;
}

export function profileImageRoute(field: ProfileImageField): string {
  return ROUTE_PATH[field];
}

/** Remove both deterministic keys when an account is deleted. */
export async function deleteProfileImages(bucket: R2Bucket, userId: string): Promise<void> {
  await Promise.all([
    bucket.delete(profileImageKey("photoUrl", userId)),
    bucket.delete(profileImageKey("companyLogoUrl", userId)),
  ]);
}

export async function uploadToR2(bucket: R2Bucket, key: string, file: File): Promise<void> {
  await bucket.put(key, file, { httpMetadata: { contentType: file.type } });
}

export type ProfileResponse = Omit<UserProfile, ProfileImageField> & {
  photoUrl: string | null;
  companyLogoUrl: string | null;
};

/**
 * Response shape for every route that returns a profile (routes/profile.ts and
 * auth.ts's /me), so those shapes can never diverge. Each stored R2 key is
 * replaced by the fixed route that serves it; absent fields become `null`.
 */
export function toProfileResponse(profile: UserProfile): ProfileResponse {
  return {
    ...profile,
    photoUrl: profile.photoUrl ? ROUTE_PATH.photoUrl : null,
    companyLogoUrl: profile.companyLogoUrl ? ROUTE_PATH.companyLogoUrl : null,
  };
}
