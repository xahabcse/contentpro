# Contributing to ContentPro

Thanks for your interest! ContentPro is MIT-licensed and contributions are welcome.

## Getting set up

The fastest way to a working environment is Docker:

```bash
docker compose up --build      # app at http://localhost:8080
```

Log in with the seeded demo account `demo@contentpro.local` / `demo1234`. See the [README](README.md#quick-start-docker) for details and optional service keys.

For iterative development you'll usually run the two apps directly (hot reload):

```bash
# terminal 1 — backend (needs api/.dev.vars, see api/wrangler.toml)
cd api && npm install && npm run dev

# terminal 2 — frontend
cd app && npm install && npm run dev
```

## Project layout

- `app/` — React/Vite frontend (Cloudflare Pages)
- `api/` — Hono API on Cloudflare Workers (MongoDB via a Durable Object)
- `brand/brand-kit.md` — the design system (tokens, fonts, palettes, templates)
- `docs/contentpro-spec.md` — the full product spec
- See the [README](README.md) for the full map.

## Before you open a PR

- **Frontend:** `cd app && npm run build && npm run lint` must pass (TypeScript + ESLint).
- **Backend:** `cd api && npm run typecheck` must pass.
- Keep changes focused; match the surrounding code style (the codebase favours small, well-commented, idiomatic modules).
- Don't commit secrets. `.env`, `.dev.vars`, and `*.local.env` are gitignored — use `.env.example` as the template.

## Guidelines

- **Security-sensitive areas** (auth, sessions, rate limiting, uploads) — describe the threat model in the PR and add/adjust checks deliberately; see the security notes in the README.
- **Design/brand changes** should update `brand/brand-kit.md` alongside the code so the two never drift.
- Open an issue first for large or architectural changes so we can align before you build.

## Reporting security issues

Please **do not** open a public issue for a vulnerability. Report it privately to the maintainer and allow time for a fix before disclosure.
