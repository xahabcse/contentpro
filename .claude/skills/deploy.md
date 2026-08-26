---
name: deploy
description: Deploy the app and/or API to production — normally via git push to main (CI auto-deploys), or manually via wrangler as fallback.
user_invocable: true
---

# Deploy to Production

ContentPro uses a **git-push-to-deploy** CI/CD pipeline. Manual wrangler deploys are a fallback only.

> Note: `app/` and `api/` don't exist in this repo yet — only `docs/contentpro-spec.md` does. This skill
> documents the intended deploy flow for when implementation begins, per the spec. Unlike the reference
> "learning" project, ContentPro deploys **directly from `main`** — there is no `dev` branch and no
> auto-merge-PR bot.

## Normal Flow (recommended)

```bash
# 1. Stage specific files — never git add -A or git add .
git add <files>

# 2. Commit
git commit -m "feat/fix/docs: short description"

# 3. Push directly to main
git push origin main
```

CI then runs automatically:

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `deploy-app.yml` | push to `main` (`app/**` changed) | Typecheck + build with `VITE_API_BASE_URL` + `VITE_TURNSTILE_SITE_KEY` → deploys `dist` to Cloudflare Pages (project `contentpro`) |
| `deploy-api.yml` | push to `main` (`api/**` changed) | Typecheck → `wrangler deploy --minify` → deploys Cloudflare Worker (`contentpro-api`) |

Each workflow **fails closed**: the typecheck/build job must pass before the deploy step/job runs — a failed build never reaches `wrangler`. There is no `ci-dev.yml`-style auto-PR/auto-merge step to replicate — if you want merge gating, add branch protection on `main` (require the workflow's check to pass) in GitHub's repo settings; that's a one-time settings change, not something either workflow file does itself.

**Monitor:** `gh run list --limit 5` or check the GitHub Actions tab.

## GitHub Secrets required

| Secret | Value |
|--------|-------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token (Pages + Workers edit scope) — *user-supplied* |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID — *user-supplied* |
| `VITE_API_BASE_URL` | Deployed `contentpro-api` Worker URL, e.g. `https://contentpro-api.<your-subdomain>.workers.dev` |
| `VITE_TURNSTILE_SITE_KEY` | Public Cloudflare Turnstile site key (not secret, but still injected at build time) — *user-supplied* |

No `GH_PAT` — that was only needed for the reference project's dev→main auto-merge bot, which ContentPro doesn't use.

### Worker runtime secrets (set once via `wrangler secret put`, not GitHub Actions)

These are consumed by the Worker at runtime, not at CI build time — set them directly against the Worker, not as GitHub Actions secrets:

| Secret | Used by |
|--------|---------|
| `JWT_SECRET` | Signing/verifying session, email-verification, and password-reset JWTs |
| `RESEND_API_KEY` | Transactional email delivery via Resend |
| `TURNSTILE_SECRET_KEY` | Server-side Turnstile siteverify call on signup |
| `CLOUDINARY_API_SECRET` | Signs Cloudinary uploads and delivery URLs |

```bash
cd api
npx wrangler secret put JWT_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put CLOUDINARY_API_SECRET
```

The database itself (Cloudflare D1) is **not** a secret — it's a plain `wrangler.toml` binding (`DB`). First-time setup needs `npx wrangler d1 create contentpro-db` (paste the returned `database_id` into `wrangler.toml`) and `npx wrangler d1 migrations apply contentpro-db --remote` (applies `api/migrations/0001_init.sql`) — see `/setup-secrets` Part 4 for the full sequence.

## Production URLs

- **App:** `<https://contentpro.pages.dev>` (raw Pages URL — placeholder; replace with the real project once created, and with a custom domain if/when one is configured)
- **API:** `<https://contentpro-api.YOUR-SUBDOMAIN.workers.dev>` (placeholder — replace `YOUR-SUBDOMAIN` with the actual Cloudflare Workers subdomain once deployed)

## Smoke Test

After deploy (wait ~60s for CDN propagation):

```bash
# App
curl -sf -o /dev/null -w "%{http_code}" https://contentpro.pages.dev/
# → 200

# API health
curl https://contentpro-api.YOUR-SUBDOMAIN.workers.dev/
# → {"ok":true,"service":"contentpro-api"}

# Key screens (static SPA serves index.html for ANY path, so a 200 confirms the
# deploy is live, not that a specific route/state exists)
for path in "/" "/signup" "/login" "/verify-email" "/forgot-password" "/dashboard" "/settings/profile" "/editor/card" "/editor/carousel"; do
  curl -s -o /dev/null -w "$path -> %{http_code}\n" "https://contentpro.pages.dev$path"
done
# Spot-check the rendered title (should be: ContentPro — LinkedIn card & carousel designer)
curl -s https://contentpro.pages.dev | grep -o '<title>[^<]*</title>'

# API auth-gated route should reject with 401, not 500 — confirms the Worker,
# JWT middleware, and D1 binding are all actually wired up
curl -s -o /dev/null -w "%{http_code}\n" https://contentpro-api.YOUR-SUBDOMAIN.workers.dev/api/designs
# → 401
```

## Manual Deploy (fallback only)

Use only if CI is broken or you need to deploy without a git push.

### App

```bash
cd app
npm ci
npm run build   # tsc + vite
npx wrangler pages deploy dist \
  --project-name=contentpro \
  --branch=main \
  --commit-dirty=true
```

### API

```bash
cd api
npm ci
CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=<account-id> \
  npx wrangler deploy --minify
```

On the **very first** API deploy only: `wrangler.toml` must already have a `[[d1_databases]]` block with a real `database_id` (not the placeholder string — see `/setup-secrets` Part 4) and the `[[migrations]]` block registering the `RateLimitDO` Durable Object — and all Worker runtime secrets above must already be set via `wrangler secret put` — before `wrangler deploy` will produce a working API. The D1 schema itself must also already be applied remotely (`wrangler d1 migrations apply contentpro-db --remote`) — a fresh deploy does not run migrations for you.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `wrangler 8000007` | Pages project doesn't exist | `npx wrangler pages project create contentpro --production-branch=main` |
| Worker deploy errors on Durable Object class | Missing `[[migrations]]` block for `RateLimitDO` | Add the `new_sqlite_classes`/`renamed_classes` entry under `[[migrations]]` in `wrangler.toml`, redeploy |
| `D1_ERROR: no such table` in the Worker | Schema migration never applied to the remote database, or `database_id` is still the placeholder | Run `wrangler d1 migrations apply contentpro-db --remote`; confirm `database_id` in `wrangler.toml` is real |
| CORS error calling the API from the app | App's Pages domain not in the Worker's CORS allow-list | Check the origin allow-list in `api/src/index.ts` |
| Signup fails Turnstile validation (400) | `TURNSTILE_SECRET_KEY` unset, or it doesn't match the widget behind `VITE_TURNSTILE_SITE_KEY` | Confirm both keys come from the same Turnstile widget in the Cloudflare dashboard |
| Verification/reset emails never arrive | `RESEND_API_KEY` missing/invalid, or sending domain not verified in Resend | Check the Resend dashboard's domain verification status |
| Downloading an export returns 403/404 | Presigned R2 URL expired (~5 min) or wrong R2 bucket binding name | Re-request the download; check the R2 binding name in `wrangler.toml` |
| CI build fails on `npm ci` in `app/` | Peer dependency conflict | Check for a newly added package that needs `--legacy-peer-deps`, or pin the conflicting version |
