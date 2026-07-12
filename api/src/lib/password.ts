// PBKDF2-HMAC-SHA256 via native Web Crypto (crypto.subtle) -- spec section 5.1.
// Deliberately NOT bcrypt/argon2/node:crypto scrypt: native .node addons never
// load in the Workers V8 isolate (no dlopen), and node:crypto scrypt is a
// documented *future* hardening path for Workers Paid, not a v1 shortcut.

const SALT_BYTES = 16;
// Iteration target. Raised from the original 60k, but capped at 100,000 because
// the Cloudflare Workers Web Crypto runtime HARD-REJECTS PBKDF2 with more than
// 100k iterations ("NotSupportedError: iteration counts above 100000 are not
// supported") -- so this is the maximum achievable here, not a CPU-budget
// compromise. (OWASP's ~600k is simply not reachable on this platform without
// moving to node:crypto scrypt, a documented future path.) The exact count used
// is stored per-user (passwordIterations), so:
//   - new signups hash at TARGET_ITERATIONS;
//   - existing users hashed at a lower count are transparently upgraded on
//     their next successful login (see needsRehash + rehash-on-login in the
//     login route).
export const TARGET_ITERATIONS = 100_000;
const DEFAULT_ITERATIONS = TARGET_ITERATIONS;
const DERIVED_KEY_BITS = 256;

// Constant fake credential for the login "user not found" branch. Deriving
// against this burns ~the same CPU as a real verify, so an attacker can't tell
// a missing account from a wrong password by response timing (enumeration).
const DUMMY_SALT = "AAAAAAAAAAAAAAAAAAAAAA==";
const DUMMY_HASH = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    DERIVED_KEY_BITS,
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export interface PasswordHashResult {
  hash: string;
  salt: string;
  iterations: number;
}

export async function hashPassword(
  password: string,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<PasswordHashResult> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const bits = await deriveBits(password, salt, iterations);
  return { hash: toBase64(bits), salt: toBase64(salt), iterations };
}

export async function verifyPassword(
  password: string,
  hash: string,
  salt: string,
  iterations: number,
): Promise<boolean> {
  const saltBytes = fromBase64(salt);
  const bits = await deriveBits(password, saltBytes, iterations);
  return timingSafeEqual(toBase64(bits), hash);
}

/**
 * Burns equivalent CPU to a real verify without revealing anything -- call this
 * on the login "email not found" path so timing doesn't leak account existence.
 * Always returns false.
 */
export async function verifyPasswordDummy(password: string): Promise<boolean> {
  return verifyPassword(password, DUMMY_HASH, DUMMY_SALT, TARGET_ITERATIONS);
}

/** True when a stored hash was derived below the current target and should be upgraded. */
export function needsRehash(iterations: number): boolean {
  return iterations < TARGET_ITERATIONS;
}
