import type { MongoConnectionDO } from "./durable-objects/mongo-connection";

/** Cloudflare resource bindings, wired up in wrangler.toml. */
export interface Bindings {
  /** private R2 bucket -- profile photos, company logos, design exports */
  FILES: R2Bucket;
  /** resend-verification / forgot-password rate-limit tracking (spec 5.3/5.4) */
  RATE_LIMIT_KV: KVNamespace;
  /** single global Mongo Connection Durable Object (spec 4.2) */
  MONGO_DO: DurableObjectNamespace<MongoConnectionDO>;
}

/** Workers secrets -- set via `wrangler secret put`, never committed (spec 5.7). */
export interface Secrets {
  MONGODB_URI: string;
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
}

/** Plain [vars] entries from wrangler.toml. */
export interface Vars {
  ENV?: string;
  FRONTEND_URL?: string;
  RESEND_FROM_EMAIL?: string;
}

export type Env = Bindings & Secrets & Vars;

/** Set by src/middleware/auth-required.ts from the session JWT's claims. */
export interface Variables {
  userId: string;
  emailVerified: boolean;
}

export type AppEnv = { Bindings: Env; Variables: Variables };
