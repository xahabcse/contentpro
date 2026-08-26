import type { Context } from "hono";
import type { AppEnv } from "../env";
import { insertAuthEvent } from "./db";
import type { AuthEventType } from "../schema";

/**
 * Best-effort audit log for auth-flow events. Inserts into the `auth_events`
 * table and NEVER throws into the request path -- any failure (D1 hiccup, etc.)
 * is swallowed so logging can't break signup/login/reset. Fire it via
 * c.executionCtx.waitUntil(...) to keep it off the response path.
 */
export async function logAuthEvent(
  c: Context<AppEnv>,
  event: { type: AuthEventType; email?: string | null; detail?: string | null },
): Promise<void> {
  try {
    await insertAuthEvent(c.env.DB, {
      ts: Date.now(),
      type: event.type,
      email: event.email ?? null,
      ip: c.req.header("cf-connecting-ip") ?? null,
      detail: event.detail ?? null,
    });
  } catch (err) {
    console.error("logAuthEvent failed", err);
  }
}
