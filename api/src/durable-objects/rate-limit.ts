import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";

// Atomic rate-limit state, stored under `rl:<key>` in DO storage. Unlike KV,
// the DO serializes all calls and gates storage ops, so get-then-put here is
// truly atomic (no interleaving, no stale/edge-cached reads) -- which KV can't
// provide, and which brute-force throttling (login) actually requires.
const RATE_LIMIT_STORAGE_PREFIX = "rl:";
// DO storage has NO TTL, so `rl:` keys would otherwise accumulate one-per
// distinct email/IP forever. A periodic alarm sweeps expired entries; the
// interval is coarse because these keys are tiny and short-lived.
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1h

interface StoredRateLimit {
  lastSentAt: number; // epoch seconds
  windowStart: number; // epoch seconds
  count: number;
  expiresAt: number; // epoch seconds -- windowStart + windowSeconds, used by the cleanup alarm
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * Single global Durable Object instance backing the security-critical auth
 * throttles (login / signup / reset-password).
 *
 * Formerly MongoConnectionDO, which also wrapped a warm MongoClient; user data
 * now lives in D1 (src/lib/db.ts), so only the rate limiter remains. The class
 * was renamed via a `renamed_classes` migration (wrangler.toml, tag v2) rather
 * than recreated, so the live `rl:` counters survived the cutover.
 *
 * Anti-spam flows (resend-verification / forgot-password) stay on the KV
 * helper in middleware/rate-limit.ts -- their 60s cooldown tolerates KV's
 * best-effort eventual consistency, and keeping them off the DO avoids
 * funnelling non-critical traffic through it.
 */
export class RateLimitDO extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async rateLimit(
    key: string,
    maxAttempts: number,
    windowSeconds: number,
    cooldownSeconds = 0,
  ): Promise<RateLimitDecision> {
    const storageKey = `${RATE_LIMIT_STORAGE_PREFIX}${key}`;
    const now = Math.floor(Date.now() / 1000);
    const existing = (await this.ctx.storage.get<StoredRateLimit>(storageKey)) ?? null;

    if (existing && cooldownSeconds > 0 && now - existing.lastSentAt < cooldownSeconds) {
      return { allowed: false, retryAfterSeconds: cooldownSeconds - (now - existing.lastSentAt) };
    }

    let next: StoredRateLimit;
    if (existing && now - existing.windowStart < windowSeconds) {
      if (existing.count >= maxAttempts) {
        return { allowed: false, retryAfterSeconds: existing.windowStart + windowSeconds - now };
      }
      next = {
        lastSentAt: now,
        windowStart: existing.windowStart,
        count: existing.count + 1,
        expiresAt: existing.windowStart + windowSeconds,
      };
    } else {
      next = { lastSentAt: now, windowStart: now, count: 1, expiresAt: now + windowSeconds };
    }

    await this.ctx.storage.put(storageKey, next);
    await this.ensureCleanupAlarm();
    return { allowed: true };
  }

  async resetRateLimit(key: string): Promise<void> {
    await this.ctx.storage.delete(`${RATE_LIMIT_STORAGE_PREFIX}${key}`);
  }

  private async ensureCleanupAlarm(): Promise<void> {
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + RATE_LIMIT_CLEANUP_INTERVAL_MS);
    }
  }

  // Sweeps expired `rl:` entries so DO storage doesn't grow unboundedly, and
  // reschedules itself while any live entries remain.
  async alarm(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const entries = await this.ctx.storage.list<StoredRateLimit>({
      prefix: RATE_LIMIT_STORAGE_PREFIX,
    });
    let remaining = 0;
    for (const [storageKey, state] of entries) {
      if (state.expiresAt <= now) {
        await this.ctx.storage.delete(storageKey);
      } else {
        remaining++;
      }
    }
    if (remaining > 0) {
      await this.ctx.storage.setAlarm(Date.now() + RATE_LIMIT_CLEANUP_INTERVAL_MS);
    }
  }
}
