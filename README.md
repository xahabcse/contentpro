# Cardstock

**Design professional LinkedIn cards & carousels yourself — in a fast, browser-based editor.**

Live: **[content.xahabcse.me](https://content.xahabcse.me)** · Repo: `xahabcse/contentpro`

Cardstock is a self-service, multi-tenant web app where users sign up and create, edit, and export their own LinkedIn **cards** (1080×1080) and **carousels** (1080×1350) from a curated set of templates — no design tool, no Canva, no Claude/CLI required for end users. The whole design engine is code (HTML/CSS rendered to PNG/PDF in the browser).

> **Cardstock** is the product brand; the repo, Worker, and database are named `contentpro` (the original internal name) — that identifier is kept everywhere in code and infrastructure.

This repo also contains a **legacy Claude-driven pipeline** (`templates/`, `scripts/render.js`, `posts/`) that predates the web app — see [Legacy pipeline](#legacy-pipeline) at the bottom.

> Open source under the [MIT License](LICENSE). Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Quick start (Docker)

Run the whole stack — frontend, the Cloudflare Worker API (via `wrangler dev`), and MongoDB — locally with one command. **No Cloudflare account, MongoDB Atlas, Resend, or Cloudinary needed.** Requires only Docker.

```bash
git clone https://github.com/xahabcse/contentpro.git
cd contentpro
docker compose up --build
```

Then open **http://localhost:8080** and log in with the seeded demo account:

| Email | Password |
|---|---|
| `demo@contentpro.local` | `demo1234` |

That's it — you can design cards & carousels, switch templates/palettes, upload backgrounds, and export PNG/PDF entirely offline. Stop with `docker compose down` (add `-v` to also wipe the local database).

**What's optional:** e-mail verification (Resend) and profile-photo / logo uploads (Cloudinary) are off by default — the demo account is already verified, and footers fall back to a placeholder avatar. To enable them, copy `.env.example` to `.env` and add your keys. Turnstile uses Cloudflare's public **test keys** (always pass) unless you supply real ones.

> Use a Chromium-based browser (Chrome/Edge) for the local run — the session cookie is `Secure`, which those browsers accept on `http://localhost`.

For manual (non-Docker) development, see [Getting started](#getting-started).

---

## Features

### Editor
- **10 fixed templates** — Quote, Big Stat, Numbered Tips, Cover/Hook, Announcement, Bold Question, Before/After, Framework, Call to Action, Statement. A curated fixed-region model, not a free-form canvas.
- **6 curated palettes** (Ink, Bone, Cobalt, Crimson, Forest, Grape) with optional per-design custom background / text / accent colors.
- **Live 3-panel editor** — template picker · WYSIWYG stage · content/theme/author inspector. Light & dark editor themes.
- **Cards & carousels** — single-slide card or multi-slide carousel (up to 15 slides) with add / delete / drag-reorder + keyboard controls.
- **Background images** with an automatic legibility scrim.
- **Two-part footer** — author lockup (avatar / placeholder + name + `@handle` + designation) and company lockup (logo + company name), cascading from your profile with per-design overrides.
- **Editable design titles** and unique, timestamped export filenames.

### Export
- **Client-side** PNG (card) / multi-page JPEG PDF (carousel) via `html2canvas` + `jsPDF`, downloaded directly — nothing is uploaded to a server.

### Accounts
- Email + password sign-up with **Cloudflare Turnstile**, **email verification** and **password reset** (via Resend).
- Profile: name, handle, designation, company name, profile photo, company logo (photo + logo hosted on Cloudinary).

### Data & privacy
- **Browser-only designs** — every design lives entirely in the user's browser (`localStorage` for design JSON + `IndexedDB` for image blobs). The server stores **only** account + profile info.
- **Backup / Restore** — export all local designs + images as a single JSON file and re-import them (mitigates the no-multi-device / cache-clear trade-off).
- Two example designs are seeded locally on first visit.

---

## Tech stack

| Layer | Tech |
|---|---|
| **Frontend** (`app/`) | React 19 · Vite 8 · React Router 7 · TypeScript · `html2canvas` · `jsPDF` — deployed to **Cloudflare Pages** |
| **Backend** (`api/`) | **Hono 4** on **Cloudflare Workers** · **MongoDB Atlas 7** (native driver) via a **Durable Object** · `zod` validation |
| **Auth** | PBKDF2-HMAC-SHA256 (Web Crypto) · JWT httpOnly-cookie sessions · Cloudflare **Turnstile** · **Resend** email |
| **Media** | **Cloudinary** (profile photo + company logo only) |
| **Fonts** | Archivo (display) · Newsreader (serif) · Space Grotesk (UI) — Google Fonts |
| **CI/CD** | GitHub Actions → Cloudflare Pages / Workers on push to `main` |

---

## Architecture

```
Browser (Cloudflare Pages)                 Cloudflare Workers (Hono)
┌──────────────────────────────┐           ┌─────────────────────────────┐
│ React SPA                    │           │ /api/auth   (signup, login, │
│  • editor / dashboard        │  cookie   │   verify, reset, me)        │
│  • localStorage  → designs   │──JWT─────▶ │ /api/profile (get/update,   │
│  • IndexedDB     → images    │           │   photo/logo upload)        │
│  • html2canvas   → PNG/PDF   │           │                             │
└──────────────────────────────┘           │  ┌───────────────────────┐  │
                                            │  │ MongoConnectionDO     │  │
   Cloudinary ◀── profile photo/logo ──────┼─▶│  (warm Mongo conn +   │  │
                                            │  │   atomic rate-limits) │  │
                                            │  └──────────┬────────────┘  │
                                            └─────────────┼───────────────┘
                                                          ▼
                                                   MongoDB Atlas
                                                   └ users (auth + profile)
```

- **Designs never touch the server.** They are created, edited, and exported entirely client-side. The only Mongo collection is `users`.
- A single global **Durable Object** (`MongoConnectionDO`) owns one warm MongoDB connection for the whole Worker (avoiding a TCP/TLS handshake per request) and also hosts the atomic auth rate-limiters.
- Sessions are stateless **JWTs in an httpOnly cookie**, carrying a `tokenVersion` that is checked against the DB each request so a password reset (or logout) can revoke live sessions.

---

## Security

- **Passwords:** PBKDF2-HMAC-SHA256 at 100k iterations (the Workers Web Crypto max), per-user salt, constant-time compare, transparent rehash-on-login for legacy hashes.
- **Sessions:** httpOnly · Secure · SameSite=Strict cookie; explicit `type: "session"` claim (action tokens can't be replayed as sessions); `alg` pinned to HS256; `tokenVersion` revocation.
- **Brute-force:** atomic Durable-Object rate-limiting on login (per-email + per-IP), signup, and password reset. Enumeration-resistant (constant-time login for unknown accounts; email sends moved off the response path).
- **Turnstile** on signup (fails closed).
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
│       │                    #   Dashboard, Editor, ProfileSettings
│       ├── components/      #   editor/SlideCanvas, layout/(AppShell, AuthShell, ProtectedRoute)
│       ├── lib/             #   local-store, image-store, export, palettes,
│       │                    #   templates, design-types, auth
│       └── styles/tokens.css#   theme tokens (chrome + editor light/dark)
├── api/                     # Backend — Hono on Cloudflare Workers
│   └── src/
│       ├── index.ts         #   app + CORS + secure headers + routes
│       ├── routes/          #   auth, profile
│       ├── middleware/      #   auth-required, email-verified-required, rate-limit
│       ├── durable-objects/ #   mongo-connection (warm conn + atomic rate-limits)
│       ├── lib/             #   jwt, password, cloudinary, resend, turnstile, ...
│       └── schema.ts        #   users collection types
├── brand/brand-kit.md       # Single source of truth for the visual brand
├── docs/contentpro-spec.md  # Full product/requirements spec
├── .github/workflows/       # deploy-api.yml, deploy-app.yml (push to main)
├── .claude/                 # specialist agents + slash-skills (see below)
├── templates/, scripts/, posts/   # Legacy Claude-driven render pipeline
└── CLAUDE.md                # Repo conventions
```

---

## Getting started

Prerequisites: **Node.js 20+**, a Cloudflare account (Workers + Pages), MongoDB Atlas, Cloudinary, Resend, and Cloudflare Turnstile.

### Frontend (`app/`)

```bash
cd app
npm install
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build  → dist/
npm run lint
npm test           # vitest
```

Env: `VITE_TURNSTILE_SITE_KEY` (Turnstile site key). The app calls the API same-origin at `/api/*`.

### Backend (`api/`)

```bash
cd api
npm install
npm run dev        # wrangler dev (local Worker)
npm run typecheck  # tsc --noEmit
npm run deploy     # wrangler deploy
```

Worker secrets (set via `wrangler secret put` or the `/setup-secrets` skill — never commit values):
`MONGODB_URI`, `JWT_SECRET`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

---

## Deployment

CI/CD runs on **push to `main`** (path-filtered — no `dev` branch, no auto-merge bot):

- `.github/workflows/deploy-app.yml` — typechecks/builds `app/`, deploys to Cloudflare Pages.
- `.github/workflows/deploy-api.yml` — typechecks `api/`, deploys the Worker.

Each job deploys only if the typecheck/build passes.

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

- **[`brand/brand-kit.md`](brand/brand-kit.md)** — design system: tokens, fonts, palettes, templates, footer.
- **[`docs/contentpro-spec.md`](docs/contentpro-spec.md)** — full product/requirements spec.
- **[`CLAUDE.md`](CLAUDE.md)** — repository conventions and working rules.
