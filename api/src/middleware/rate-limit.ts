// KV-backed rate limiting. Two use classes:
//   - resend-verification / forgot-password (spec 5.3/5.4): ~60s cooldown
//     between sends, ~5/hour cap per address (the defaults below).
//   - auth abuse limits (login/signup/reset-password): higher attempt caps
//     over a shorter window, no cooldown, keyed by email AND/OR IP -- passed
//     explicitly via `options`.
//
// Keyed by a caller-supplied identifier (lowercased email, or an IP). Not a
// Hono middleware factory (each flow needs its own `prefix` so counters don't
// collide) -- call `checkAndRecordRateLimit` directly from the route handler.
//
// NON-ATOMICITY CAVEAT (accepted for v1): this does read-then-write on KV,
// which is eventually consistent and has no compare-and-set. Concurrent
// requests (or requests hitting different edge colos) can both read stale
// state and both pass, so these caps are best-effort throttles, not hard
// guarantees. Making them atomic would require moving the counter into a
// Durable Object (single-owner, serialized) -- deliberately NOT done here to
// keep the change small. Treat KV limits as slowing bulk abuse, not blocking it.

const DEFAULT_COOLDOWN_SECONDS = 60;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_SECONDS = 60 * 60;

export interface RateLimitOptions {
  /** Minimum seconds between two accepted calls. 0 disables the cooldown. */
  cooldownSeconds?: number;
  /** Max accepted calls within `windowSeconds`. */
  maxAttempts?: number;
  /** Rolling window length in seconds. */
  windowSeconds?: number;
}

interface RateLimitState {
  lastSentAt: number; // epoch seconds
  windowStart: number; // epoch seconds
  count: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

function keyFor(prefix: string, identifier: string): string {
  return `ratelimit:${prefix}:${identifier.trim().toLowerCase()}`;
}

export async function checkAndRecordRateLimit(
  kv: KVNamespace,
  prefix: string,
  identifier: string,
  options?: RateLimitOptions,
): Promise<RateLimitResult> {
  const cooldownSeconds = options?.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS;
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const windowSeconds = options?.windowSeconds ?? DEFAULT_WINDOW_SECONDS;

  const key = keyFor(prefix, identifier);
  const now = Math.floor(Date.now() / 1000);
  const raw = await kv.get(key);
  const existing: RateLimitState | null = raw ? (JSON.parse(raw) as RateLimitState) : null;

  if (existing && cooldownSeconds > 0 && now - existing.lastSentAt < cooldownSeconds) {
    return { allowed: false, retryAfterSeconds: cooldownSeconds - (now - existing.lastSentAt) };
  }

  let next: RateLimitState;
  if (existing && now - existing.windowStart < windowSeconds) {
    if (existing.count >= maxAttempts) {
      return { allowed: false, retryAfterSeconds: existing.windowStart + windowSeconds - now };
    }
    next = { lastSentAt: now, windowStart: existing.windowStart, count: existing.count + 1 };
  } else {
    next = { lastSentAt: now, windowStart: now, count: 1 };
  }

  await kv.put(key, JSON.stringify(next), { expirationTtl: windowSeconds });
  return { allowed: true };
}

/**
 * Clears a counter -- used to reset the login attempt counter on a successful
 * authentication so legitimate users aren't throttled by their own past typos.
 */
export async function resetRateLimit(
  kv: KVNamespace,
  prefix: string,
  identifier: string,
): Promise<void> {
  await kv.delete(keyFor(prefix, identifier));
}
