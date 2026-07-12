import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./env";
import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profile";

const app = new Hono<AppEnv>();

// Cookie-based CORS (credentials: true) -- the session JWT travels as an
// httpOnly cookie, not an Authorization header, so this is NOT the
// Bearer-token CORS pattern. Allow-list localhost (dev), any *.pages.dev
// preview/production deploy, and the eventual apex domain.
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return undefined;
      const allowed =
        /^https?:\/\/(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|[a-z0-9-]+\.pages\.dev|content\.xahabcse\.me)$/i.test(
          origin,
        );
      return allowed ? origin : undefined;
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

export default app;
export { MongoConnectionDO } from "./durable-objects/mongo-connection";
