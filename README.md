# Cardstock

**Design Facebook and LinkedIn cards and carousels in a fast, browser-based editor.**

Live: **[content.xahabcse.me](https://content.xahabcse.me)** · Repo: `xahabcse/contentpro`

Cardstock is a self-service web app where users sign up and create, edit, and export **cards** (1080×1080) and **carousels** (1080×1350) from a curated set of templates. Export cards as PNG, carousels as a multi-page PDF for LinkedIn or a ZIP of ordered PNG slides for Facebook and other platforms. The design engine renders HTML/CSS in the browser.

> **Cardstock** is the product brand; the repo, Worker, and database are named `contentpro` (the original internal name) — that identifier is kept everywhere in code and infrastructure.

This repo also contains a **legacy Claude-driven pipeline** (`templates/`, `scripts/render.js`, `posts/`) that predates the web app — see [Legacy pipeline](#legacy-pipeline) at the bottom.

> Open source under the [MIT License](LICENSE). Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Quick start (Docker)

Run the frontend and Cloudflare Worker API (via `wrangler dev`, with local D1 SQLite and R2 emulation) with one command. The seeded demo account needs no Cloudflare account or Resend key. You need Docker and an internet connection to pull images/install packages and to complete the Cloudflare Turnstile check when logging in.

```bash
git clone https://github.com/xahabcse/contentpro.git
cd contentpro
docker compose up --build
```

Then open **http://localhost:8080** and log in with the seeded demo account:

| Email | Password |
|---|---|
| `demo@contentpro.local` | `demo1234` |

After logging in, you can design cards and carousels, switch templates and palettes, upload backgrounds, and export PNG/PDF/ZIP in your browser. D1 and R2 run locally in Docker. Google Fonts and Turnstile load from the internet; login and signup also call Cloudflare's Turnstile verification service. Stop with `docker compose down` (add `-v` to also wipe the local database).

**What's optional:** The demo account is already verified. Creating accounts and resetting passwords by email require a Resend API key and sender setup; copy `.env.example` to `.env` to configure them. Profile-photo and company-logo uploads use local R2 emulation without credentials. Turnstile uses Cloudflare's public **test keys** by default, but its widget and server-side verification still require internet access.

> Use a Chromium-based browser (Chrome/Edge) for the local run — the session cookie is `Secure`, which those browsers accept on `http://localhost`.

For manual (non-Docker) development, see [Getting started](#getting-started).

---

## Features

### Editor
- **100 fixed templates** — including tutorial and learning posts, bullet lessons, progress trackers, line/bar/pie/donut charts, career milestones, community updates, business announcements, and everyday messages. Every template works as a card or a carousel slide. A curated fixed-region model, not a free-form canvas.
- **10 curated palettes** (Ink, Paper, Slate, Navy, Forest, Wine, Sand, Charcoal, Cobalt, Plum) with optional per-design custom background / text / accent colors.
- **Live 3-panel editor** — template picker · WYSIWYG stage · content/theme/author inspector. Light & dark editor themes.
- **Cards & carousels** — single-slide card or multi-slide carousel (up to 15 slides) with add / delete / drag-reorder + keyboard controls.
- **Background images** with an automatic legibility scrim.
- **Two-part footer** — author lockup (avatar / placeholder + name + `@handle` + designation) and company lockup (logo + company name), cascading from your profile with per-design overrides.
- **Editable design titles** and unique, timestamped export filenames.

### Export
- **Client-side** 1080×1080 PNG cards and multi-page PDFs or ordered PNG ZIPs for carousels via `html2canvas`, `jsPDF`, and `JSZip`. Downloads are generated in the browser — design content is not uploaded to the server.

### Accounts
- Email + password sign-up with **Cloudflare Turnstile**, **email verification** and **password reset** (via Resend).
- Profile: name, handle, designation, company name, profile photo, company logo (photo + logo stored in a private Cloudflare R2 bucket, streamed back through the API — never a public URL).

### Data & privacy
- **Account-scoped local drafts** — designs remain in this browser (`localStorage` for design JSON and `IndexedDB` for image blobs), separated by signed-in account ID. They do not sync across devices. The server stores account/profile data and auth events, not designs.
- **Backup / Restore** — download the current account's local designs and images as JSON. Restore imports copies with new IDs, preserving existing designs; use it to move designs between browsers or devices. Backups have a 100 MB limit, and editor image uploads have an 8 MB per-file limit.
- Two example designs are seeded for each account on its first dashboard visit. Designs saved before account scoping are not assigned automatically; the dashboard offers a one-time, explicit import when older local designs exist.

---

## Tech stack

| Layer | Tech |
|---|---|
| **Frontend** (`app/`) | React 19 · Vite 8 · React Router 7 · TypeScript · `html2canvas` · `jsPDF` · `JSZip` — deployed to **Cloudflare Pages** |
| **Backend** (`api/`) | **Hono 4** on **Cloudflare Workers** · **Cloudflare D1** (SQLite) · a slim **Durable Object** (`RateLimitDO`) for atomic auth rate-limiting · `zod` validation |
| **Auth** | PBKDF2-HMAC-SHA256 (Web Crypto) · JWT httpOnly-cookie sessions · Cloudflare **Turnstile** · **Resend** email |
| **Media** | **Cloudflare R2** (private bucket; profile photo + company logo only) |
| **Fonts** | Archivo (display) · Newsreader (serif) · Space Grotesk (UI) — Google Fonts |
| **CI/CD** | GitHub Actions → Cloudflare Pages / Workers on push to `main` |

---

## Architecture

```
Browser (Cloudflare Pages)                 Cloudflare Workers (Hono)
┌──────────────────────────────┐           ┌─────────────────────────────┐
│ React SPA                    │           │ /api/auth   (signup, login, │
│  • editor / dashboard        │  cookie   │   verify, reset, me)        │
│  • localStorage  → drafts    │──JWT─────▶ │ /api/profile (get/update,   │
│    by account ID             │           │   photo/logo upload+stream) │
│  • IndexedDB → owner/images  │           │                             │
│  • html2canvas   → PNG/PDF   │           │                             │
└──────────────────────────────┘           │  ┌───────────────────────┐  │
                                            │  │ RateLimitDO           │  │
                                            │  │  (atomic auth         │  │
                                            │  │   throttling only)    │  │
                                            │  └───────────────────────┘  │
                                            │  ┌───────────────────────┐  │
                                            │  │ R2: PROFILE_IMAGES    │  │
                                            │  │  (private; streamed   │  │
                                            │  │   back through this   │  │
                                            │  │   Worker, no public   │  │
                                            │  │   or signed URL)      │  │
                                            │  └──────────┬────────────┘  │
                                            └─────────────┼───────────────┘
                                                          ▼
                                                   Cloudflare D1
                                                   └ users, auth_events
```

- **Designs never touch the server.** They are created, edited, and exported client-side under separate local storage keys for each account. D1 stores `users` and `auth_events`.
- A single global **Durable Object** (`RateLimitDO`) does atomic brute-force throttling for login/signup/reset-password — unrelated to the database; D1, unlike a persistent-TCP-connection database, needs no warm-connection wrapper.
- Sessions are stateless **JWTs in an httpOnly cookie**, carrying a `sessionVersion` that is checked against the DB each request so a password reset can revoke live sessions. Kept as its own counter, separate from the `tokenVersion` used to invalidate email-verification/password-reset links, so the unauthenticated forgot-password/resend-verification routes can't force-logout an arbitrary account by email alone.

---

## Security

- **Passwords:** PBKDF2-HMAC-SHA256 at 100k iterations (the Workers Web Crypto max), per-user salt, constant-time compare, transparent rehash-on-login for legacy hashes.
- **Sessions:** httpOnly · Secure · SameSite=Strict cookie; explicit `type: "session"` claim (action tokens can't be replayed as sessions); `alg` pinned to HS256; `sessionVersion` revocation.
- **Brute-force:** atomic Durable-Object rate-limiting on login (per-email + per-IP), signup, and password reset. Enumeration-resistant (constant-time login for unknown accounts; email sends moved off the response path).
- **Turnstile** on signup and login (fails closed).
- **CORS** pinned to owned origins only (no wildcard `*.pages.dev`).
- **Uploads:** MIME + magic-byte validation, size cap, per-user rate cap.
- **HTTP headers** (`app/public/_headers`): Content-Security-Policy, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`, Referrer-Policy, Permissions-Policy. No source maps in production.
- **Client:** no XSS surface (all user text is escaped React children), no token in `localStorage` (httpOnly cookie only).

---

## Project structure

```
.
├── app/                     # Frontend — React/Vite (Cloudflare Pages)
│   ├── public/_headers      #   security headers for the Pages site
│   └── src/
│       ├── pages/           #   Landing, Login, Signup, VerifyEmail, Forgot/Reset,
│       │                    #   Dashboard, Editor, ProfileSettings, Admin
│       ├── components/      #   TurnstileWidget, editor/SlideCanvas, layout/(AppShell, AuthShell, ProtectedRoute)
│       ├── lib/             #   local-store, image-store, export, palettes,
│       │                    #   templates, design-types, auth
│       └── styles/tokens.css#   theme tokens (chrome + editor light/dark)
├── api/                     # Backend — Hono on Cloudflare Workers
│   └── src/
│       ├── index.ts         #   app + CORS + secure headers + routes
│       ├── routes/          #   auth, profile, admin
│       ├── middleware/      #   auth-required, email-verified-required, admin-required, rate-limit
│       ├── durable-objects/ #   rate-limit (RateLimitDO — atomic auth throttling only)
│       ├── lib/             #   db (D1 data access), jwt, password, storage (R2), resend, turnstile, ...
│       └── schema.ts        #   users / auth_events row types
├── brand/brand-kit.md       # Current brand summary and legacy pipeline rules
├── docs/contentpro-spec.md  # Original requirements and design history
├── .github/workflows/       # PR checks plus deploy-api.yml/deploy-app.yml (push to main)
├── .claude/                 # specialist agents + slash-skills (see below)
├── templates/, scripts/, posts/   # Legacy Claude-driven render pipeline
└── CLAUDE.md                # Repo conventions
```

---

## Getting started

For local development: **Node.js 24**, npm, and internet access for package installation, Google Fonts, and Turnstile. `wrangler dev` emulates D1 and R2 locally; no Cloudflare account is required for the seeded demo. Production deployment needs Cloudflare resources and credentials; email signup/reset additionally needs Resend.

### Frontend (`app/`)

```bash
cd app
npm ci
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build  → dist/
npm run lint
npm test           # vitest
```

For the local demo, create `app/.env` with `VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA` (Cloudflare's public test site key). This file is gitignored. The app calls `/api/*`; Vite proxies it to `http://localhost:8787`. Start the backend below in another terminal, then open `http://localhost:5173`.

### Backend (`api/`)

```bash
cd api
npm ci
npx wrangler d1 migrations apply contentpro-db --local
npx wrangler d1 execute contentpro-db --local --file=./seed.sql
npm run dev        # wrangler dev (local Worker)
npm run typecheck  # tsc --noEmit
npm test
```

For local development, copy `api/.dev.vars.example` to `api/.dev.vars` and set a local `JWT_SECRET`, `FRONTEND_URL=http://localhost:5173`, and Cloudflare's public test secret `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`. Leave `RESEND_API_KEY` blank if using only the seeded demo account. Create this file before starting `npm run dev`; never commit it. The local demo login is `demo@contentpro.local` / `demo1234`.

For production, set `JWT_SECRET`, `RESEND_API_KEY`, and `TURNSTILE_SECRET_KEY` with `wrangler secret put` or `/setup-secrets`, provision the private R2 `PROFILE_IMAGES` bucket, and deploy with `npm run deploy` from `api/` or the CI workflow.

### Local browser QA

With Docker running, install root and app dependencies (`npm ci` in both directories), then run `node scripts/qa-local-ui.cjs` and `node scripts/qa-template-overflow.cjs` from the repository root. Set `CHROME_PATH` if Chrome is not in its standard Windows location and Playwright's Chromium is not installed. The first script checks responsive gallery/editor navigation, that the old `/admin` address shows the not-found page, and PNG/PDF/ZIP exports; the second checks all 62 newer templates at card and carousel sizes for clipping. Browser QA stubs auth/profile responses; API auth and the admin gateway are covered by `npm test` in `api/`.

---

## Deployment

CI runs build, lint, and tests for pull requests to `main`; deployment runs on **push to `main`** (path-filtered — no `dev` branch, no auto-merge bot):

- `.github/workflows/checks.yml` — builds, lints, and tests the app; typechecks and tests the API on pull requests.
- `.github/workflows/deploy-app.yml` — builds, lints, and tests `app/`, then deploys to Cloudflare Pages.
- `.github/workflows/deploy-api.yml` — typechecks and tests `api/`, then deploys the Worker.

Deploy jobs run only after their checks pass.

---

## Tooling (`.claude/`)

Specialist agents and slash-skills scaffolded for this stack:

| Agents | Skills |
|---|---|
| `cf-api-engineer` (backend) · `app-engineer` (frontend/design) · `release-engineer` (ship/CI) · `ui-tester` (live QA) | `/deploy` · `/setup-secrets` · `/build-check` · `/ui-test` |

---

## Legacy pipeline

The original code-only pipeline (predates the web app) renders LinkedIn posts from HTML/CSS templates with Playwright:

```bash
npm install                              # playwright + sharp (root)
npx playwright install chromium
node scripts/render.js posts/<slug>      # auto-detects card vs carousel from content.json
```

- `templates/single-card.html`, `templates/carousel-styles.css` — templates
- `posts/<slug>/content.json` — per-post content → `posts/<slug>/output/` (PNG / PDF)

It uses an **older mint-green / Plus Jakarta Sans** brand, distinct from the ContentPro web-app brand. Both are documented in [`brand/brand-kit.md`](brand/brand-kit.md).

---

## Documentation

- **[`brand/brand-kit.md`](brand/brand-kit.md)** — current brand summary and legacy pipeline rules; the app's theme values live in `app/src/styles/tokens.css`.
- **[`docs/contentpro-spec.md`](docs/contentpro-spec.md)** — original requirements and design history; this README describes the current implementation.
- **[`CLAUDE.md`](CLAUDE.md)** — repository conventions and working rules.
