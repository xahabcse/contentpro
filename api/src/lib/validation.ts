import { zValidator } from "@hono/zod-validator";
import type { ZodType } from "zod";

/**
 * Wraps zValidator with a hook that formats failures as { error: "<first
 * issue message>" } -- matching the plain-string error shape every other
 * route in this API returns. Without this, @hono/zod-validator's default
 * failure response is { success: false, error: <raw ZodError> }, and every
 * frontend page's `body.error || 'fallback'` renders `[object Object]`
 * instead of a readable message.
 */
export function jsonValidator<T extends ZodType>(schema: T) {
  return zValidator("json", schema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "Invalid request.";
      return c.json({ error: message }, 400);
    }
  });
}
