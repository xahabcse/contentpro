import type { Context } from "hono";
import type { AppEnv, Env } from "../env";
import type { AuthEventType } from "../schema";

function mongoStub(env: Env) {
  const id = env.MONGO_DO.idFromName("global-mongo-connection");
  return env.MONGO_DO.get(id);
}

/**
 * Best-effort audit log for auth-flow events. Inserts into the `auth_events`
 * collection and NEVER throws into the request path -- any failure (Mongo
 * hiccup, etc.) is swallowed so logging can't break signup/login/reset. Fire
 * it via c.executionCtx.waitUntil(...) to keep it off the response path.
 */
export async function logAuthEvent(
  c: Context<AppEnv>,
  event: { type: AuthEventType; email?: string | null; detail?: string | null },
): Promise<void> {
  try {
    await mongoStub(c.env).insertAuthEvent({
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
