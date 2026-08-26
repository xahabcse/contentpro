// Every `{ error: "CODE" }` the Worker can return, mapped to something a
// person can act on. Sources: api/src/routes/{auth,profile,admin}.ts,
// api/src/middleware/*.ts, api/src/index.ts.
//
// Two response shapes exist and both land in `body.error`:
//   1. a SCREAMING_SNAKE code (the table below);
//   2. a plain sentence, when zod rejects the request body
//      (api/src/lib/validation.ts returns the first issue's message).
// So anything that doesn't look like a code is treated as already-human and
// passed through -- and an *unrecognised* code never reaches the screen,
// because showing "TURNSTILE_FAILED" to a user is the bug this module exists
// to prevent.

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
export const NETWORK_ERROR_MESSAGE = "We couldn't reach the server. Check your connection and try again.";

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "That email and password don't match. Please try again.",
  EMAIL_IN_USE: 'An account with that email already exists. Try logging in instead.',
  TURNSTILE_FAILED: "We couldn't confirm you're human. Complete the check and try again.",
  UNAUTHENTICATED: 'Your session has ended. Please log in again.',
  EMAIL_NOT_VERIFIED: 'Verify your email address first — check your inbox for the link.',
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "We couldn't find what you were looking for.",
  CANNOT_DELETE_ADMIN: 'That account is an admin and cannot be deleted.',
  INVALID_OR_EXPIRED_TOKEN: 'This link is invalid or has expired. Please request a new one.',
  FILE_TOO_LARGE: 'That image is too large. Please choose a file under 5 MB.',
  FILE_REQUIRED: 'Please choose an image to upload.',
  UNSUPPORTED_FILE_TYPE: "That file type isn't supported. Upload a PNG, JPEG or WebP image.",
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again in a moment.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
};

const CODE_SHAPE = /^[A-Z][A-Z0-9_]*$/;

// zod's defaults are accurate but read like a stack trace. Only the handful
// that can actually surface (email + password fields) are rewritten.
const REPHRASE: { match: RegExp; message: string }[] = [
  { match: /invalid email/i, message: 'Enter a valid email address.' },
  { match: /at least 8 character/i, message: 'Your password must be at least 8 characters.' },
];

function polish(sentence: string): string {
  for (const { match, message } of REPHRASE) {
    if (match.test(sentence)) return message;
  }
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

/**
 * Turns a backend error code (or a server-supplied sentence) into copy that
 * can be shown to a user as-is.
 */
export function humanizeApiError(code: string, fallback: string = GENERIC_ERROR_MESSAGE): string {
  const key = code.trim();
  if (!key) return fallback;
  const mapped = MESSAGES[key];
  if (mapped) return mapped;
  if (CODE_SHAPE.test(key)) return fallback;
  return polish(key);
}

/** "45 seconds" / "2 minutes", or null when the value is missing/nonsensical. */
export function formatRetryAfter(seconds: unknown): string | null {
  const value = typeof seconds === 'number' ? seconds : Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  const whole = Math.ceil(value);
  if (whole < 60) return `${whole} second${whole === 1 ? '' : 's'}`;
  const minutes = Math.ceil(whole / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export function rateLimitedMessage(retryAfterSeconds?: unknown): string {
  const wait = formatRetryAfter(retryAfterSeconds);
  return wait ? `Too many attempts. Please try again in ${wait}.` : MESSAGES.RATE_LIMITED;
}

interface ApiErrorBody {
  error?: unknown;
  message?: unknown;
  retryAfterSeconds?: unknown;
}

function asRecord(body: unknown): ApiErrorBody {
  return body !== null && typeof body === 'object' ? (body as ApiErrorBody) : {};
}

/** Picks the best message out of a parsed `{ error, message, retryAfterSeconds }` body. */
export function messageFromErrorBody(body: unknown, fallback: string = GENERIC_ERROR_MESSAGE): string {
  const { error, message, retryAfterSeconds } = asRecord(body);
  if (error === 'RATE_LIMITED') return rateLimitedMessage(retryAfterSeconds);
  if (typeof error === 'string' && error.trim()) return humanizeApiError(error, fallback);
  // Some routes answer with only a human `message` and no code.
  if (typeof message === 'string' && message.trim()) return polish(message.trim());
  return fallback;
}

function statusFallback(status: number, fallback: string): string {
  if (status === 401) return MESSAGES.UNAUTHENTICATED;
  if (status === 403) return MESSAGES.FORBIDDEN;
  if (status === 404) return MESSAGES.NOT_FOUND;
  if (status === 429) return MESSAGES.RATE_LIMITED;
  if (status >= 500) return MESSAGES.INTERNAL_ERROR;
  return fallback;
}

/**
 * Reads a failed Response and returns display-ready copy. Safe on empty or
 * non-JSON bodies (a Pages/proxy HTML error page, say), which fall back to
 * something sensible for the status code.
 */
export async function readApiError(res: Response, fallback: string = GENERIC_ERROR_MESSAGE): Promise<string> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    return statusFallback(res.status, fallback);
  }
  return messageFromErrorBody(body, statusFallback(res.status, fallback));
}
