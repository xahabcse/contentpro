// Hand-rolled HS256 JWT sign/verify via native Web Crypto (crypto.subtle).
//
// This deliberately does NOT use the `jose` package's verify path or
// `hono/jwt` here: both are fine on Workers in principle, but a small,
// dependency-free HMAC-SHA256 implementation is easier to audit end-to-end
// and avoids any risk of a library internally reaching for something that
// doesn't behave identically under workerd. `jose` remains listed in
// package.json for any future need (e.g. asymmetric keys), it's just not on
// the hot path for this project's session/action tokens.

export type ActionTokenType = "email_verification" | "password_reset";

export interface SessionTokenPayload {
  sub: string; // userId
  emailVerified: boolean;
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

export async function signSessionToken(
  userId: string,
  emailVerified: boolean,
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    sub: userId,
    emailVerified,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  return signJwt(payload, secret);
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionTokenPayload | null> {
  return verifyJwt<SessionTokenPayload>(token, secret);
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
