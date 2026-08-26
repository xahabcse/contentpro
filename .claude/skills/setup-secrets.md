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
| Database | **Cloudflare D1**, database `contentpro-db` — no secret involved, just a `wrangler.toml` `[[d1_databases]]` binding (`DB`); see Part 4 below for provisioning |
| R2 bucket | `contentpro-profile-images` (private — profile photo + company logo only; binding `PROFILE_IMAGES`; no secret involved, just a `wrangler.toml` binding — see Part 5 below for provisioning) |
| KV namespace | `RATE_LIMIT_KV` (resend/reset rate-limit tracking; also a binding, not a secret) |

> **Prerequisite:** the Worker's `wrangler.toml` needs a `[[d1_databases]]` block with a real `database_id` (see Part 4) and the `RateLimitDO` Durable Object's `[[migrations]]` entries in place before first deploy. Unlike the project's old Mongo-based setup, D1 needs no `nodejs_compat_v2`/`node:net`-style compatibility flag to function — it's queried through a plain Workers binding, not a network driver.

## Part 1 — Cloudflare Worker Secrets

Worker secrets are set via `wrangler secret put`. **Critical:** always use `printf` (not `echo`) to avoid a UTF-8 BOM being prepended. A leading BOM is invisible when you print the value back, but it silently corrupts it — a BOM'd `TURNSTILE_SECRET_KEY`/`RESEND_API_KEY` gets rejected by the provider's API as a bad credential, and a BOM'd `JWT_SECRET` just quietly stops matching whatever value you have recorded elsewhere (e.g. a local `.dev.vars` file), producing signature-mismatch failures with no obvious cause.

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

# RESEND_API_KEY (from Resend dashboard → API Keys)
printf '<resend_api_key>' | \
  CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=<account_id> \
  npx wrangler secret put RESEND_API_KEY --name contentpro-api

# TURNSTILE_SECRET_KEY (from Cloudflare dashboard → Turnstile → your widget → Secret Key)
printf '<turnstile_secret_key>' | \
  CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=<account_id> \
  npx wrangler secret put TURNSTILE_SECRET_KEY --name contentpro-api
```

There is no Cloudinary secret to set — profile photo / company logo storage is Cloudflare R2 (private bucket, binding `PROFILE_IMAGES`), which needs zero secrets/credentials, just a one-time bucket creation + `wrangler.toml` binding. See Part 5 below.

### Verify secrets are set

```bash
CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=<account_id> \
  npx wrangler secret list --name contentpro-api
# Should show: JWT_SECRET, RESEND_API_KEY, TURNSTILE_SECRET_KEY
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

## Part 4 — Cloudflare D1 Setup

Unlike the project's old MongoDB Atlas setup, this is **not** a secret at all — D1 is reached via a plain `wrangler.toml` binding (`DB`), never a connection string. Run these once, from `api/`:

1. `npx wrangler d1 create contentpro-db` — creates the database on the real Cloudflare account and prints a `database_id`.
2. Paste that `database_id` into `api/wrangler.toml`'s `[[d1_databases]]` block — it ships as a literal placeholder string (`"PLACEHOLDER-run-wrangler-d1-create-and-fill-this-in"`) until this step is done.
3. `npx wrangler d1 migrations apply contentpro-db --remote` — applies the schema in `api/migrations/0001_init.sql` (`users`, `auth_events`) to the real remote database. This is a live-database mutation; confirm before running it against production.
4. Do **not** run `api/seed.sql` against `--remote` — it's a local-only demo-account fixture, applied only via `wrangler d1 execute contentpro-db --local --file=./seed.sql` for local dev.

## Part 5 — Cloudflare R2 Setup (profile photo + company logo)

Like D1, this is **not** a secret at all — profile photo and company logo storage is a private R2 bucket, reached via a plain `wrangler.toml` `[[r2_buckets]]` binding (`PROFILE_IMAGES`), never a credential. R2's local emulation under `wrangler dev` needs zero setup, so this only matters for the real remote account. Run once, from `api/`:

1. `npx wrangler r2 bucket create contentpro-profile-images` — creates the private bucket on the real Cloudflare account. There is no public-access toggle to enable — it stays private by default, which is what this project relies on.
2. Confirm `api/wrangler.toml` has a matching `[[r2_buckets]]` block: `binding = "PROFILE_IMAGES"`, `bucket_name = "contentpro-profile-images"`.
3. That's it — no signing keys, no delivery-URL configuration, nothing else to provision. `GET /api/profile/photo` and `GET /api/profile/logo` stream the object bytes straight back through the Worker after an ownership check; there is no public URL and no presigned/signed URL of any kind for this bucket.

**Historical note:** this project briefly ran profile photo/company logo storage through Cloudinary as an interim workaround, back when R2 bucket creation was blocked on a manual one-time dashboard step. That's resolved — Cloudinary has been removed from the codebase entirely (no `CLOUDINARY_*` secrets/vars, no signing code), and storage is back to R2 as originally designed.

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `D1_ERROR: no such table: users` after deploy | The schema migration was never applied to the remote database | Run `npx wrangler d1 migrations apply contentpro-db --remote` (Part 4) |
| Worker deploy fails referencing the D1 binding | `database_id` in `api/wrangler.toml` is still the placeholder string | Run `npx wrangler d1 create contentpro-db` and paste the real id in (Part 4) |
| Turnstile siteverify returns `invalid-input-secret` | Wrong or BOM'd `TURNSTILE_SECRET_KEY`, or it's paired with a different widget's site key | Re-set with `printf`; confirm the site key and secret key came from the same Turnstile widget |
| Turnstile widget never renders on the signup page | `VITE_TURNSTILE_SITE_KEY` missing at build time | Set the GitHub secret and re-run the deploy — Vite bakes this in at build time, so a rebuild is required, not just a Worker restart |
| Resend emails not sending / API returns 401 | Wrong or BOM'd `RESEND_API_KEY` | Re-set with `printf`; verify the key in the Resend dashboard |
| Profile photo/company logo upload or fetch fails referencing R2 | `[[r2_buckets]]` binding (`PROFILE_IMAGES`) missing or misnamed in `api/wrangler.toml`, or the bucket was never created on this account | Run `npx wrangler r2 bucket create contentpro-profile-images` (Part 5) and confirm the binding name matches |
| `Authentication error [code: 10000]` on wrangler commands | Wrong Cloudflare account targeted | Set `CLOUDFLARE_ACCOUNT_ID` explicitly before the command |
| CI deploy fails with 401 | Wrong or expired `CLOUDFLARE_API_TOKEN` | Rotate the token in the Cloudflare dashboard, update the GitHub secret |
| All sessions/verification/reset links suddenly invalid after a deploy | `JWT_SECRET` was regenerated or overwritten | Treat `JWT_SECRET` as write-once per environment — rotating it invalidates every outstanding session, email-verification, and password-reset token |
