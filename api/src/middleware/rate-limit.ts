// KV-backed rate limiting for resend-verification / forgot-password (spec
// sections 5.3/5.4): ~60s cooldown between sends, ~5/hour cap per address,
// keyed by lowercased email. Deliberately not a Hono middleware factory
// (it needs a per-route `prefix` so the two flows don't share one counter) --
// call `checkAndRecordRateLimit` directly from the route handler instead.

const COOLDOWN_SECONDS = 60;
const HOURLY_CAP = 5;
const WINDOW_SECONDS = 60 * 60;

interface RateLimitState {
  lastSentAt: number; // epoch seconds
  windowStart: number; // epoch seconds
  count: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

function keyFor(prefix: string, email: string): string {
  return `ratelimit:${prefix}:${email.trim().toLowerCase()}`;
}

export async function checkAndRecordRateLimit(
  kv: KVNamespace,
  prefix: string,
  email: string,
): Promise<RateLimitResult> {
  const key = keyFor(prefix, email);
  const now = Math.floor(Date.now() / 1000);
  const raw = await kv.get(key);
  const existing: RateLimitState | null = raw ? (JSON.parse(raw) as RateLimitState) : null;

  if (existing && now - existing.lastSentAt < COOLDOWN_SECONDS) {
    return { allowed: false, retryAfterSeconds: COOLDOWN_SECONDS - (now - existing.lastSentAt) };
  }

  let next: RateLimitState;
  if (existing && now - existing.windowStart < WINDOW_SECONDS) {
    if (existing.count >= HOURLY_CAP) {
      return { allowed: false, retryAfterSeconds: existing.windowStart + WINDOW_SECONDS - now };
    }
    next = { lastSentAt: now, windowStart: existing.windowStart, count: existing.count + 1 };
  } else {
    next = { lastSentAt: now, windowStart: now, count: 1 };
  }

  await kv.put(key, JSON.stringify(next), { expirationTtl: WINDOW_SECONDS });
  return { allowed: true };
}
