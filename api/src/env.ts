import type { RateLimitDO } from "./durable-objects/rate-limit";

/** Cloudflare resource bindings, wired up in wrangler.toml. */
export interface Bindings {
  /** resend-verification / forgot-password rate-limit tracking (spec 5.3/5.4) */
  RATE_LIMIT_KV: KVNamespace;
  /** users + auth_events; schema in api/migrations, access via lib/db.ts */
  DB: D1Database;
  /** single global Durable Object backing the atomic login/signup/reset throttles */
  RATE_LIMIT_DO: DurableObjectNamespace<RateLimitDO>;
  /** private bucket for profile photos + company logos; served via lib/storage.ts */
  PROFILE_IMAGES: R2Bucket;
}

/** Workers secrets -- set via `wrangler secret put`, never committed (spec 5.7). */
export interface Secrets {
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
}

/** Plain [vars] entries from wrangler.toml. */
export interface Vars {
  ENV?: string;
  FRONTEND_URL?: string;
  RESEND_FROM_EMAIL?: string;
  /**
   * Comma-separated allowlist of admin email addresses. Not a credential --
   * access still requires logging in as that account -- so a plain var is fine.
   */
  ADMIN_EMAILS?: string;
}

export type Env = Bindings & Secrets & Vars;

/** Set by src/middleware/auth-required.ts from the session JWT's claims. */
export interface Variables {
  userId: string;
  emailVerified: boolean;
  /**
   * Set only by the private AdminGateway (src/admin-gateway.ts) after it has resolved
   * the admin actor; authRequired then trusts userId/emailVerified instead of a cookie.
   */
  viaAdminGateway?: boolean;
}

export type AppEnv = { Bindings: Env; Variables: Variables };
