import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { AppEnv } from "./env";
import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profile";

// Cookie-based CORS (credentials: true) -- the session JWT travels as an
// httpOnly cookie, not an Authorization header, so this is NOT the Bearer-token
// CORS pattern. With credentials, the allow-list must be tight: reflecting any
// *.pages.dev would trust every Cloudflare Pages project on the internet. Pin
// to exactly what we own -- localhost/127.0.0.1 (dev), the production custom
// domain, and only THIS Pages project's origins:
//   - contentpro.pages.dev            (production Pages deploy)
//   - <deploy>.contentpro.pages.dev   (branch/preview deploys of THIS project)
// Nothing else under pages.dev is accepted.
const ALLOWED_ORIGIN =
  /^https?:\/\/(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|([a-z0-9-]+\.)?contentpro\.pages\.dev|content\.xahabcse\.me)$/i;

/**
 * The public API behind content.xahabcse.me/api/*.
 *
 * It has no /api/admin any more: the admin of Cardstock lives at admin.xahabcse.me
 * and reaches routes/admin.ts only through the private AdminGateway entrypoint
 * (admin-gateway.ts, exported from index.ts). Here those paths are plain 404s.
 */
export function createPublicApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // Baseline hardening headers (X-Content-Type-Options: nosniff, etc.) -- matters
  // because /api/profile/{photo,logo} stream user-uploaded bytes back out.
  app.use("*", secureHeaders());

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return undefined;
        return ALLOWED_ORIGIN.test(origin) ? origin : undefined;
      },
      credentials: true,
      allowHeaders: ["Content-Type"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    }),
  );

  app.route("/api/auth", authRoutes);
  app.route("/api/profile", profileRoutes);

  app.get("/", (c) => c.json({ ok: true, service: "contentpro-api" }));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "INTERNAL_ERROR" }, 500);
  });

  return app;
}
