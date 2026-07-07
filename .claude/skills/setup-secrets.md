---
name: setup-secrets
description: Step-by-step guide for setting Cloudflare Worker secrets (BOM-safe via printf) and GitHub Actions secrets for the ContentPro project. Run this when deploying to a new account or rotating credentials.
user_invocable: true
---

# Setup Secrets — ContentPro Project

Two places need secrets: the **Cloudflare Worker** (`api/`, runtime secrets) and **GitHub Actions** (CI/CD secrets, used by `deploy-api.yml` / `deploy-app.yml` on push to `main`).

This doc covers *how* to set each secret and *what it's for* — you provide the real values yourself; nothing below contains an actual key/token/password.

## Cloudflare Account Info

| Field | Value |
|-------|-------|
| Account | `<your-cloudflare-account-email>` |
| Account ID | `<run \`wrangler whoami\` to find it — same value as \`CLOUDFLARE_ACCOUNT_ID\` below>` |
| Pages project | `contentpro` |
| Worker name | `contentpro-api` |
| Database | MongoDB Atlas M0 cluster, database `contentpro` (**not** Cloudflare D1) — connection string stored as the `MONGODB_URI` Worker secret |
| R2 bucket | `contentpro-files` (private — profile photos, company logos, exported PNG/PDF; no secret involved, just a `wrangler.toml` binding) |
| KV namespace | `RATE_LIMIT_KV` (resend/reset rate-limit tracking; also a binding, not a secret) |

> **Prerequisite:** the Worker's `wrangler.toml` needs `compatibility_flags = ["nodejs_compat_v2"]` and `compatibility_date >= 2025-03-20`, plus a `[[migrations]]` block (`new_classes = ["MongoConnectionDO"]`) on first deploy. Without these, `MONGODB_URI` is set correctly but the native MongoDB driver still won't connect — this is the single most common first-deploy failure and is unrelated to the secret value itself.

## Part 1 — Cloudflare Worker Secrets

Worker secrets are set via `wrangler secret put`. **Critical:** always use `printf` (not `echo`) to avoid a UTF-8 BOM being prepended. A leading BOM is invisible when you print the value back, but it silently corrupts it — a BOM'd `MONGODB_URI` fails the driver's connection-string scheme check, a BOM'd `TURNSTILE_SECRET_KEY`/`RESEND_API_KEY` gets rejected by the provider's API as a bad credential, and a BOM'd `JWT_SECRET` just quietly stops matching whatever value you have recorded elsewhere (e.g. a local `.dev.vars` file), producing signature-mismatch failures with no obvious cause.

### Required env vars

```bash
# Set these for every wrangler command to target the correct account:
export CLOUDFLARE_API_TOKEN="<contentpro_api_token>"
export CLOUDFLARE_ACCOUNT_ID="<contentpro_account_id>"
```

### Set each secret

```bash
cd api

# JWT_SECRET — generate a fresh 32-byte hex:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy the output, then:
printf '<generated_hex>' | CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=<account_id> \
  npx wrangler secret put JWT_SECRET --name contentpro-api

# MONGODB_URI (from MongoDB Atlas → Database → Connect → Drivers → Node.js)
printf 'mongodb+srv://<user>:<password>@<cluster-host>/contentpro?retryWrites=true&w=majority' | \
  CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=<account_id> \
  npx wrangler secret put MONGODB_URI --name contentpro-api

# RESEND_API_KEY (from Resend dashboard → API Keys)
printf '<resend_api_key>' | \
  CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=<account_id> \
  npx wrangler secret put RESEND_API_KEY --name contentpro-api

# TURNSTILE_SECRET_KEY (from Cloudflare dashboard → Turnstile → your widget → Secret Key)
printf '<turnstile_secret_key>' | \
  CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=<account_id> \
  npx wrangler secret put TURNSTILE_SECRET_KEY --name contentpro-api
```

### Verify secrets are set

```bash
CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=<account_id> \
  npx wrangler secret list --name contentpro-api
# Should show: JWT_SECRET, MONGODB_URI, RESEND_API_KEY, TURNSTILE_SECRET_KEY
```

### Diagnose BOM issue

If a secret that "looks right" is still being rejected, check for an invisible leading BOM:

```bash
CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=<account_id> \
  npx wrangler tail --name contentpro-api
# Trigger the failing request (e.g. hit /api/auth/login or /api/auth/signup) and watch the live log.
# A BOM shows up in raw error output as `﻿` or, in a URL-encoded context, `%EF%BB%BF`
# immediately before the value it corrupted.
# Fix: re-run the printf command above for that secret.
```

## Part 2 — GitHub Actions Secrets

Go to: `https://github.com/xahabcse/contentpro/settings/secrets/actions`

Or set via CLI:

```bash
cd <contentpro-repo-root>

gh secret set CLOUDFLARE_API_TOKEN      # Cloudflare API token, scoped to Workers + Pages edit
gh secret set CLOUDFLARE_ACCOUNT_ID     # your Cloudflare account ID
gh secret set VITE_API_BASE_URL         # https://contentpro-api.<your-subdomain>.workers.dev
gh secret set VITE_TURNSTILE_SITE_KEY   # Turnstile site key (public value, baked in at build time)
```

### Required secrets table

| Secret | Used by | Value |
|--------|---------|-------|
| `CLOUDFLARE_API_TOKEN` | `deploy-api.yml`, `deploy-app.yml` | Cloudflare API token with Workers Scripts + Pages edit permissions |
| `CLOUDFLARE_ACCOUNT_ID` | `deploy-api.yml`, `deploy-app.yml` | Your Cloudflare account ID |
| `VITE_API_BASE_URL` | `deploy-app.yml` | Deployed Worker URL, e.g. `https://contentpro-api.<subdomain>.workers.dev` |
| `VITE_TURNSTILE_SITE_KEY` | `deploy-app.yml` | Turnstile **site** key — public by design, but still supplied at build time via a GitHub secret since Vite bakes it into the static bundle |

Both workflows trigger on push to `main` (path-filtered — `deploy-api.yml` on `api/**`, `deploy-app.yml` on `app/**`), run typecheck/build first, and only deploy if that build step passes. There is no `dev` branch and no auto-merge bot in this repo, so unlike a GH-PAT-driven auto-merge setup, **no `GH_PAT` secret is needed here**. There's also no `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` — ContentPro uses email+password auth, not Google OAuth.

## Part 3 — Cloudflare Turnstile Setup

Turnstile is Cloudflare's own CAPTCHA, used only on the public signup form (`POST /api/auth/signup`).

1. Cloudflare dashboard → **Turnstile** → **Add widget**.
2. Name it (e.g. "ContentPro Signup") and add the domain(s) it will run on — your production frontend domain, plus `localhost` if you want it working in local dev.
3. Widget mode: "Managed" is a reasonable default.
4. Creating the widget gives you two keys:
   - **Site Key** — public, meant to be visible in the frontend. Goes into the `VITE_TURNSTILE_SITE_KEY` GitHub Actions secret (Part 2), which Vite bakes into the signup page at build time.
   - **Secret Key** — private, never exposed to the browser. Goes into the `TURNSTILE_SECRET_KEY` Worker secret (Part 1), used server-side when `/api/auth/signup` calls Cloudflare's siteverify endpoint to validate the token before creating a user.
5. Domain/widget changes can take a few minutes to propagate.

## Part 4 — MongoDB Atlas Setup

1. [MongoDB Atlas](https://cloud.mongodb.com) → **Create a cluster** → pick the free **M0** tier.
2. **Database Access** → Add New Database User — create a dedicated user with a strong generated password. This user/password pair is embedded directly in the connection string.
3. **Network Access** → Add IP Access List Entry → **allow `0.0.0.0/0`** (or, if you'd rather scope it, Cloudflare's published IP ranges — but Workers do **not** have a fixed egress IP, so a narrower single-IP allowlist will not work). This is a common first-deploy stumbling block: if Atlas's IP allowlist doesn't include the Worker's request, the connection just times out with no clear error pointing at "network access," and it's easy to burn time suspecting the connection string or the driver instead.
4. **Database** → **Connect** → **Drivers** → Node.js — copy the connection string. It looks like:

   ```text
   mongodb+srv://<user>:<password>@<cluster-host>/contentpro?retryWrites=true&w=majority
   ```

5. Use database name `contentpro`. This full string (with your real user/password filled in) is exactly what goes into the `MONGODB_URI` Worker secret in Part 1 — nothing else needs to reference Atlas directly.

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| MongoDB connection times out / never connects | Atlas Network Access doesn't allow the Worker's request | Add `0.0.0.0/0` to the Atlas IP Access List — Workers have no fixed egress IP |
| MongoDB URI rejected as malformed despite looking correct | BOM in `MONGODB_URI` | Re-set with `printf` (not `echo`) |
| Turnstile siteverify returns `invalid-input-secret` | Wrong or BOM'd `TURNSTILE_SECRET_KEY`, or it's paired with a different widget's site key | Re-set with `printf`; confirm the site key and secret key came from the same Turnstile widget |
| Turnstile widget never renders on the signup page | `VITE_TURNSTILE_SITE_KEY` missing at build time | Set the GitHub secret and re-run the deploy — Vite bakes this in at build time, so a rebuild is required, not just a Worker restart |
| Resend emails not sending / API returns 401 | Wrong or BOM'd `RESEND_API_KEY` | Re-set with `printf`; verify the key in the Resend dashboard |
| `Authentication error [code: 10000]` on wrangler commands | Wrong Cloudflare account targeted | Set `CLOUDFLARE_ACCOUNT_ID` explicitly before the command |
| CI deploy fails with 401 | Wrong or expired `CLOUDFLARE_API_TOKEN` | Rotate the token in the Cloudflare dashboard, update the GitHub secret |
| All sessions/verification/reset links suddenly invalid after a deploy | `JWT_SECRET` was regenerated or overwritten | Treat `JWT_SECRET` as write-once per environment — rotating it invalidates every outstanding session, email-verification, and password-reset token |
