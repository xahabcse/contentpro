import { Hono } from "hono";
import type { AppEnv } from "./env";
import { isAdminEmail } from "./lib/admin";
import { findUserByEmail } from "./lib/db";
import adminRoutes from "./routes/admin";

// The admin of portfolio, NewsPortal and Cardstock now lives at admin.xahabcse.me
// (portfolio repo, docs/rules/unified-admin.md). Its API reaches this Worker only
// through a Cloudflare service binding to the named entrypoint AdminGateway
// (index.ts), which the public internet cannot call. The portfolio API checks
// the admin's own login first and names the admin in X-Admin-Actor; this app maps
// that email to the Cardstock account and runs the normal /api/admin routes as it.
// The header is trusted only because nothing outside the binding can reach here,
// and the account must still be verified and on ADMIN_EMAILS, exactly what
// adminRequired checks again downstream.
export function createGatewayApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    const actor = (c.req.header("X-Admin-Actor") ?? "").trim().toLowerCase();
    if (!actor) {
      return c.json({ error: "FORBIDDEN" }, 403);
    }

    const user = await findUserByEmail(c.env.DB, actor);
    if (!user || user.emailVerified !== true || !isAdminEmail(c.env, user.email)) {
      return c.json({ error: "FORBIDDEN" }, 403);
    }

    c.set("viaAdminGateway", true);
    c.set("userId", user._id);
    c.set("emailVerified", true);
    await next();
  });

  app.route("/api/admin", adminRoutes);

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "INTERNAL_ERROR" }, 500);
  });

  return app;
}
