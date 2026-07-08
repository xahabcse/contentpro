import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { AppEnv, Env } from "../env";
import { hashPassword, verifyPassword } from "../lib/password";
import { signActionToken, signSessionToken, verifyActionToken } from "../lib/jwt";
import { sendPasswordResetEmail, sendVerificationEmail } from "../lib/resend";
import { verifyTurnstileToken } from "../lib/turnstile";
import { authRequired, SESSION_COOKIE_NAME } from "../middleware/auth-required";
import { checkAndRecordRateLimit } from "../middleware/rate-limit";
import type { NewUserInput } from "../schema";

const auth = new Hono<AppEnv>();

function mongoStub(env: Env) {
  const id = env.MONGO_DO.idFromName("global-mongo-connection");
  return env.MONGO_DO.get(id);
}

function resendConfig(env: Env) {
  return {
    apiKey: env.RESEND_API_KEY,
    from: env.RESEND_FROM_EMAIL ?? "ContentPro <noreply@contentpro.app>",
    frontendUrl: env.FRONTEND_URL ?? "http://localhost:5173",
  };
}

const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, matches jwt.ts's session TTL

const GENERIC_RATE_LIMITED_MESSAGE =
  "If an account with that email exists, we've sent instructions. Please wait before requesting again.";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  turnstileToken: z.string().min(1),
});

// Signup open to anyone (spec 5.5) -- Turnstile is the only bot defense here.
auth.post("/signup", zValidator("json", signupSchema), async (c) => {
  const { email, password, turnstileToken } = c.req.valid("json");
  const normalizedEmail = email.toLowerCase();

  const turnstileOk = await verifyTurnstileToken(
    turnstileToken,
    c.env.TURNSTILE_SECRET_KEY,
    c.req.header("cf-connecting-ip"),
  );
  if (!turnstileOk) {
    return c.json({ error: "TURNSTILE_FAILED" }, 400);
  }

  const stub = mongoStub(c.env);
  const existing = await stub.findUserByEmail(normalizedEmail);
  if (existing) {
    return c.json({ error: "EMAIL_IN_USE" }, 409);
  }

  const { hash, salt, iterations } = await hashPassword(password);
  const now = new Date();
  const newUser: NewUserInput = {
    email: normalizedEmail,
    passwordHash: hash,
    passwordSalt: salt,
    passwordIterations: iterations,
    emailVerified: false,
    tokenVersion: 0,
    createdAt: now,
    updatedAt: now,
    profile: {},
  };
  const userId = await stub.insertUser(newUser);

  const token = await signActionToken(userId, normalizedEmail, "email_verification", 0, c.env.JWT_SECRET);
  await sendVerificationEmail(normalizedEmail, token, resendConfig(c.env));

  return c.json({ message: "Account created. Check your email to verify it." }, 201);
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Issues a session JWT regardless of emailVerified status (spec 4.1/5.3) --
// the frontend uses the claim to route to Dashboard vs. the Verify-Email
// Notice screen, but server-side enforcement is emailVerifiedRequired on
// Profile/Designs routes, not this decision.
auth.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const normalizedEmail = email.toLowerCase();

  const stub = mongoStub(c.env);
  const user = await stub.findUserByEmail(normalizedEmail);
  if (!user) {
    return c.json({ error: "INVALID_CREDENTIALS" }, 401);
  }

  const valid = await verifyPassword(password, user.passwordHash, user.passwordSalt, user.passwordIterations);
  if (!valid) {
    return c.json({ error: "INVALID_CREDENTIALS" }, 401);
  }

  await stub.updateUser(user._id, { lastLoginAt: new Date() });

  const token = await signSessionToken(user._id, user.emailVerified, c.env.JWT_SECRET);
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });

  return c.json({ id: user._id, email: user.email, emailVerified: user.emailVerified });
});

// Flat shape -- matches app/src/lib/auth.tsx's AuthContext User type exactly
// (setUser(await res.json())), not wrapped in a `user` key.
auth.get("/me", authRequired, async (c) => {
  const stub = mongoStub(c.env);
  const user = await stub.findUserById(c.get("userId"));
  if (!user) return c.json({ error: "NOT_FOUND" }, 404);

  return c.json({
    id: user._id,
    email: user.email,
    emailVerified: user.emailVerified,
    profile: user.profile,
  });
});

auth.post("/logout", async (c) => {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ message: "Logged out." });
});

const verifyEmailSchema = z.object({ token: z.string().min(1) });

auth.post("/verify-email", zValidator("json", verifyEmailSchema), async (c) => {
  const { token } = c.req.valid("json");
  const payload = await verifyActionToken(token, "email_verification", c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, 400);
  }

  const stub = mongoStub(c.env);
  const user = await stub.findUserById(payload.sub);
  // v mismatch guards against a stale/superseded link being used after a resend.
  if (!user || user.tokenVersion !== payload.v) {
    return c.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, 400);
  }

  await stub.updateUser(user._id, { emailVerified: true, updatedAt: new Date() });
  return c.json({ message: "Email verified. Please log in again." });
});

const emailOnlySchema = z.object({ email: z.string().email() });

auth.post("/resend-verification", zValidator("json", emailOnlySchema), async (c) => {
  const { email } = c.req.valid("json");
  const normalizedEmail = email.toLowerCase();

  const rate = await checkAndRecordRateLimit(c.env.RATE_LIMIT_KV, "resend-verification", normalizedEmail);
  if (!rate.allowed) {
    return c.json({ error: "RATE_LIMITED", message: GENERIC_RATE_LIMITED_MESSAGE, retryAfterSeconds: rate.retryAfterSeconds }, 429);
  }

  const stub = mongoStub(c.env);
  const user = await stub.findUserByEmail(normalizedEmail);
  if (user && !user.emailVerified) {
    // Increment tokenVersion first -- instantly invalidates any prior outstanding link.
    const nextVersion = user.tokenVersion + 1;
    await stub.updateUser(user._id, { tokenVersion: nextVersion });
    const token = await signActionToken(user._id, normalizedEmail, "email_verification", nextVersion, c.env.JWT_SECRET);
    await sendVerificationEmail(normalizedEmail, token, resendConfig(c.env));
  }

  // Generic response regardless of account existence -- no email enumeration (spec 5.3).
  return c.json({ message: "If an account with that email exists, we've sent a new verification link." });
});

auth.post("/forgot-password", zValidator("json", emailOnlySchema), async (c) => {
  const { email } = c.req.valid("json");
  const normalizedEmail = email.toLowerCase();

  const rate = await checkAndRecordRateLimit(c.env.RATE_LIMIT_KV, "forgot-password", normalizedEmail);
  if (!rate.allowed) {
    return c.json({ error: "RATE_LIMITED", message: GENERIC_RATE_LIMITED_MESSAGE, retryAfterSeconds: rate.retryAfterSeconds }, 429);
  }

  const stub = mongoStub(c.env);
  const user = await stub.findUserByEmail(normalizedEmail);
  if (user) {
    const nextVersion = user.tokenVersion + 1;
    await stub.updateUser(user._id, { tokenVersion: nextVersion });
    const token = await signActionToken(user._id, normalizedEmail, "password_reset", nextVersion, c.env.JWT_SECRET);
    await sendPasswordResetEmail(normalizedEmail, token, resendConfig(c.env));
  }

  // Generic response regardless of account existence -- no email enumeration (spec 5.4).
  return c.json({ message: "If an account with that email exists, we've sent password reset instructions." });
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(200),
});

auth.post("/reset-password", zValidator("json", resetPasswordSchema), async (c) => {
  const { token, password } = c.req.valid("json");
  const payload = await verifyActionToken(token, "password_reset", c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, 400);
  }

  const stub = mongoStub(c.env);
  const user = await stub.findUserById(payload.sub);
  if (!user || user.tokenVersion !== payload.v) {
    return c.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, 400);
  }

  const { hash, salt, iterations } = await hashPassword(password);
  await stub.updateUser(user._id, {
    passwordHash: hash,
    passwordSalt: salt,
    passwordIterations: iterations,
    // Increment again -- invalidates the reset token itself and any other
    // outstanding verification/reset links (spec 5.4).
    tokenVersion: user.tokenVersion + 1,
    updatedAt: new Date(),
  });

  return c.json({ message: "Password reset. Please log in with your new password." });
});

export default auth;
