import { jsonValidator } from "../lib/validation";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { AppEnv, Env } from "../env";
import { hashPassword, needsRehash, verifyPassword, verifyPasswordDummy } from "../lib/password";
import { signActionToken, signSessionToken, verifyActionToken } from "../lib/jwt";
import { signProfileImageUrls } from "../lib/cloudinary";
import { sendPasswordResetEmail, sendVerificationEmail } from "../lib/resend";
import { verifyTurnstileToken } from "../lib/turnstile";
import { authRequired, SESSION_COOKIE_NAME } from "../middleware/auth-required";
import { checkAndRecordRateLimit } from "../middleware/rate-limit";
import type { NewUserInput } from "../schema";

// Duplicate-key sentinel thrown by MongoConnectionDO.insertUser -- RPC across
// the DO boundary preserves Error.message but not custom props, so match on the
// message string.
const DUPLICATE_EMAIL_ERROR = "DUPLICATE_EMAIL";

// Auth-abuse throttles. These are ATOMIC (backed by the global DO's serialized
// storage, not KV) -- KV edge-caches reads ~60s with no read-your-writes, so
// rapid sequential login attempts all read a stale counter and the cap never
// fires. The DO get-then-put can't interleave, so brute-force is actually
// blocked. maxAttempts/windowSeconds/cooldownSeconds map to DO.rateLimit args.
// Login: ~8 failed attempts per 15 min, per email and per IP, reset on success.
const LOGIN_LIMIT = { maxAttempts: 8, windowSeconds: 15 * 60, cooldownSeconds: 0 };
// Signup / reset-password: per-IP cap so one host can't mass-create accounts or
// hammer the reset endpoint (the emailed token is high-entropy, but cap anyway).
const IP_AUTH_LIMIT = { maxAttempts: 15, windowSeconds: 60 * 60, cooldownSeconds: 0 };

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header("cf-connecting-ip") ?? "unknown-ip";
}

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
auth.post("/signup", jsonValidator(signupSchema), async (c) => {
  const { email, password, turnstileToken } = c.req.valid("json");
  const normalizedEmail = email.toLowerCase();

  const stub = mongoStub(c.env);
  const ipRate = await stub.rateLimit(
    `signup-ip:${clientIp(c)}`,
    IP_AUTH_LIMIT.maxAttempts,
    IP_AUTH_LIMIT.windowSeconds,
    IP_AUTH_LIMIT.cooldownSeconds,
  );
  if (!ipRate.allowed) {
    return c.json({ error: "RATE_LIMITED", retryAfterSeconds: ipRate.retryAfterSeconds }, 429);
  }

  const turnstileOk = await verifyTurnstileToken(
    turnstileToken,
    c.env.TURNSTILE_SECRET_KEY,
    c.req.header("cf-connecting-ip"),
  );
  if (!turnstileOk) {
    return c.json({ error: "TURNSTILE_FAILED" }, 400);
  }

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

  let userId: string;
  try {
    userId = await stub.insertUser(newUser);
  } catch (err) {
    // Closes the TOCTOU race between the findUserByEmail check above and the
    // unique-index insert -- surface it as the same 409 rather than a 500.
    if (err instanceof Error && err.message === DUPLICATE_EMAIL_ERROR) {
      return c.json({ error: "EMAIL_IN_USE" }, 409);
    }
    throw err;
  }

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
// Notice screen, but server-side enforcement is emailVerifiedRequired on the
// Profile routes, not this decision.
auth.post("/login", jsonValidator(loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const normalizedEmail = email.toLowerCase();
  const ip = clientIp(c);
  const stub = mongoStub(c.env);

  // Atomic brute-force throttle (DO storage, not KV -- see LOGIN_LIMIT note):
  // fail closed if EITHER the per-email OR per-IP counter is exhausted. Both
  // are recorded on every attempt and cleared on success.
  const [emailRate, ipRate] = await Promise.all([
    stub.rateLimit(`login-email:${normalizedEmail}`, LOGIN_LIMIT.maxAttempts, LOGIN_LIMIT.windowSeconds, LOGIN_LIMIT.cooldownSeconds),
    stub.rateLimit(`login-ip:${ip}`, LOGIN_LIMIT.maxAttempts, LOGIN_LIMIT.windowSeconds, LOGIN_LIMIT.cooldownSeconds),
  ]);
  if (!emailRate.allowed || !ipRate.allowed) {
    const retryAfterSeconds = Math.max(emailRate.retryAfterSeconds ?? 0, ipRate.retryAfterSeconds ?? 0);
    return c.json({ error: "RATE_LIMITED", retryAfterSeconds }, 429);
  }

  const user = await stub.findUserByEmail(normalizedEmail);
  if (!user) {
    // Burn equivalent CPU so response timing doesn't reveal that the account is
    // missing (account enumeration). Always fails.
    await verifyPasswordDummy(password);
    return c.json({ error: "INVALID_CREDENTIALS" }, 401);
  }

  const valid = await verifyPassword(password, user.passwordHash, user.passwordSalt, user.passwordIterations);
  if (!valid) {
    return c.json({ error: "INVALID_CREDENTIALS" }, 401);
  }

  const userUpdate: Parameters<typeof stub.updateUser>[1] = { lastLoginAt: new Date() };
  // Rehash-on-login: transparently upgrade legacy low-iteration hashes to the
  // current target now that we hold the plaintext, without forcing a reset.
  if (needsRehash(user.passwordIterations)) {
    const rehashed = await hashPassword(password);
    userUpdate.passwordHash = rehashed.hash;
    userUpdate.passwordSalt = rehashed.salt;
    userUpdate.passwordIterations = rehashed.iterations;
  }
  await stub.updateUser(user._id, userUpdate);

  // Successful auth -- clear the throttle counters for this email + IP.
  await Promise.all([
    stub.resetRateLimit(`login-email:${normalizedEmail}`),
    stub.resetRateLimit(`login-ip:${ip}`),
  ]);

  const token = await signSessionToken(user._id, user.emailVerified, user.tokenVersion, c.env.JWT_SECRET);
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
    // Sign the Cloudinary URLs at response time -- keep parity with
    // GET /api/profile, which also returns signed URLs.
    profile: await signProfileImageUrls(user.profile, c.env.CLOUDINARY_API_SECRET, c.env.CLOUDINARY_CLOUD_NAME),
  });
});

auth.post("/logout", async (c) => {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ message: "Logged out." });
});

const verifyEmailSchema = z.object({ token: z.string().min(1) });

auth.post("/verify-email", jsonValidator(verifyEmailSchema), async (c) => {
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

auth.post("/resend-verification", jsonValidator(emailOnlySchema), async (c) => {
  const { email } = c.req.valid("json");
  const normalizedEmail = email.toLowerCase();

  // Stays on KV (not the DO): this is anti-spam (a 60s cooldown on emails),
  // not brute-force defense, so KV's best-effort eventual consistency is fine.
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
    // Send off the response path so latency is identical whether or not the
    // account exists -- closes the timing-based enumeration channel (spec 5.3).
    c.executionCtx.waitUntil(sendVerificationEmail(normalizedEmail, token, resendConfig(c.env)));
  }

  // Generic response regardless of account existence -- no email enumeration (spec 5.3).
  return c.json({ message: "If an account with that email exists, we've sent a new verification link." });
});

auth.post("/forgot-password", jsonValidator(emailOnlySchema), async (c) => {
  const { email } = c.req.valid("json");
  const normalizedEmail = email.toLowerCase();

  // Stays on KV (not the DO): anti-spam email cooldown, not brute-force -- KV's
  // best-effort consistency is acceptable here.
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
    // Send off the response path -- constant response timing regardless of
    // account existence (spec 5.4).
    c.executionCtx.waitUntil(sendPasswordResetEmail(normalizedEmail, token, resendConfig(c.env)));
  }

  // Generic response regardless of account existence -- no email enumeration (spec 5.4).
  return c.json({ message: "If an account with that email exists, we've sent password reset instructions." });
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(200),
});

auth.post("/reset-password", jsonValidator(resetPasswordSchema), async (c) => {
  const stub = mongoStub(c.env);
  const ipRate = await stub.rateLimit(
    `reset-password-ip:${clientIp(c)}`,
    IP_AUTH_LIMIT.maxAttempts,
    IP_AUTH_LIMIT.windowSeconds,
    IP_AUTH_LIMIT.cooldownSeconds,
  );
  if (!ipRate.allowed) {
    return c.json({ error: "RATE_LIMITED", retryAfterSeconds: ipRate.retryAfterSeconds }, 429);
  }

  const { token, password } = c.req.valid("json");
  const payload = await verifyActionToken(token, "password_reset", c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: "INVALID_OR_EXPIRED_TOKEN" }, 400);
  }

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
