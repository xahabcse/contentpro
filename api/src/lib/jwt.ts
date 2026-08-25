// Hand-rolled HS256 JWT sign/verify via native Web Crypto (crypto.subtle).
//
// This deliberately does NOT use `jose` or `hono/jwt` here: both are fine on
// Workers in principle, but a small, dependency-free HMAC-SHA256
// implementation is easier to audit end-to-end and avoids any risk of a
// library internally reaching for something that doesn't behave identically
// under workerd.

export type ActionTokenType = "email_verification" | "password_reset";

export interface SessionTokenPayload {
  sub: string; // userId
  type: "session"; // domain separation from action tokens (both signed with JWT_SECRET)
  emailVerified: boolean;
  v: number; // sessionVersion at issuance -- checked against the DB in authRequired for revocation
  iat: number;
  exp: number;
}

export interface ActionTokenPayload {
  sub: string; // userId
  email: string;
  type: ActionTokenType;
  v: number; // tokenVersion at issuance -- see spec 5.3/5.4
  iat: number;
  exp: number;
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const ACTION_TOKEN_TTL_SECONDS = 45 * 60; // 45 min -- within the spec's 30-60 min window

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function stringToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToBytes(value: string): Uint8Array {
  const padLength = (4 - (value.length % 4)) % 4;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlToString(value: string): string {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signJwt(payload: object, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = stringToBase64Url(JSON.stringify(header));
  const encodedPayload = stringToBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function verifyJwt<T extends { exp: number }>(token: string, secret: string): Promise<T | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

  // Pin the algorithm: only HS256 is ever issued here. Rejecting anything else
  // up front closes the classic JWT alg-confusion / "alg":"none" class of
  // attacks (not exploitable given the HMAC-only verify below, but cheap and
  // regression-proof to enforce explicitly).
  try {
    const header = JSON.parse(base64UrlToString(encodedHeader)) as { alg?: string };
    if (header.alg !== "HS256") return null;
  } catch {
    return null;
  }

  const key = await importHmacKey(secret);
  const signatureBytes = base64UrlToBytes(encodedSignature);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes as BufferSource,
    new TextEncoder().encode(signingInput),
  );
  if (!valid) return null;

  let payload: T;
  try {
    payload = JSON.parse(base64UrlToString(encodedPayload)) as T;
  } catch {
    return null;
  }

  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

// `sessionVersion` (NOT tokenVersion) -- see schema.ts. Only a password reset
// bumps it, so the unauthenticated forgot-password / resend-verification routes
// can no longer invalidate a victim's live sessions.
export async function signSessionToken(
  userId: string,
  emailVerified: boolean,
  sessionVersion: number,
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    sub: userId,
    type: "session",
    emailVerified,
    v: sessionVersion,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  return signJwt(payload, secret);
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionTokenPayload | null> {
  const payload = await verifyJwt<SessionTokenPayload>(token, secret);
  // Reject action tokens (email_verification / password_reset) being replayed
  // as a session cookie -- they omit `type: "session"`.
  if (!payload || payload.type !== "session") return null;
  return payload;
}

export async function signActionToken(
  userId: string,
  email: string,
  type: ActionTokenType,
  tokenVersion: number,
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: ActionTokenPayload = {
    sub: userId,
    email: email.toLowerCase(),
    type,
    v: tokenVersion,
    iat: now,
    exp: now + ACTION_TOKEN_TTL_SECONDS,
  };
  return signJwt(payload, secret);
}

export async function verifyActionToken(
  token: string,
  expectedType: ActionTokenType,
  secret: string,
): Promise<ActionTokenPayload | null> {
  const payload = await verifyJwt<ActionTokenPayload>(token, secret);
  if (!payload || payload.type !== expectedType) return null;
  return payload;
}
