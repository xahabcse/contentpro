# Contributing to Cardstock

Cardstock is MIT-licensed and contributions are welcome.

## Getting set up

The fastest way to a working environment is Docker. Internet access is needed for image/package downloads and Cloudflare Turnstile verification during login:

```bash
docker compose up --build      # app at http://localhost:8080
```

Log in with the seeded demo account `demo@contentpro.local` / `demo1234`. See the [README](README.md#quick-start-docker) for details and optional service keys.

For iterative development, follow the [manual setup steps](README.md#getting-started) to configure `api/.dev.vars` and `app/.env`, apply local D1 migrations, and seed the demo account. Then run the two apps directly for hot reload:

```bash
# terminal 1 — backend
cd api && npm run dev

# terminal 2 — frontend
cd app && npm run dev
```

## Project layout

- `app/` — React/Vite frontend (Cloudflare Pages)
- `api/` — Hono API on Cloudflare Workers (Cloudflare D1 database)
- `brand/brand-kit.md` — current app brand summary and legacy pipeline rules
- `docs/contentpro-spec.md` — original requirements and design history
- See the [README](README.md) for the full map.

## Before you open a PR

- **Frontend:** run `npm run build`, `npm run lint`, and `npm test` from `app/`.
- **Backend:** run `npm run typecheck` and `npm test` from `api/`.
- Keep changes focused; match the surrounding code style (the codebase favours small, well-commented, idiomatic modules).
- Don't commit secrets. `.env`, `.dev.vars` and `.secret/` are gitignored. Keep the local copy of every credential in `.secret/` ([docs/rules/secrets.md](docs/rules/secrets.md)); `api/.dev.vars.example` lists the Worker's local variables.

## Guidelines

- **Security-sensitive areas** (auth, sessions, rate limiting, uploads) — describe the threat model in the PR and add/adjust checks deliberately; see the security notes in the README.
- **Design/brand changes** should update `brand/brand-kit.md` alongside `app/src/styles/tokens.css`, palette metadata, or template code so they stay aligned.
- Open an issue first for large or architectural changes so we can align before you build.

## Reporting security issues

Please **do not** open a public issue for a vulnerability. Report it privately to the maintainer and allow time for a fix before disclosure.
