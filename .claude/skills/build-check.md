---
name: build-check
description: Run a production build of the ContentPro app (Vite/React/TS) and report on size, warnings, and broken imports. Doesn't deploy — pure sanity check before committing or pushing to main.
user_invocable: true
---

# Build Check Skill

Run the production build and produce a concise health report. Use this before committing significant changes or before pushing to `main` (which triggers `deploy-app.yml` — see "Don't deploy from this skill" below).

**Prerequisite:** `app/` must contain the scaffolded Vite/React/TS frontend, with a `package.json` `build` script running `tsc -b && vite build` (per `docs/contentpro-spec.md` §2/§10 step 1). ContentPro's `app/` doesn't exist yet as of this writing — once it's scaffolded, this skill applies unchanged.

## Steps

### 1. Clean-ish build

```bash
cd app
rm -rf dist/
npm run build
```

### 2. Capture output

- Errors → fail fast
- Warnings → report (especially chunk-size, and the font/export-pipeline concerns below)
- Final bundle sizes

### 3. Generate report

```md
## Build Health Report

**Build time:** Ns
**Generated chunks:** N files
**Total dist size:** N MB

### Main entry
- `index-<hash>.js`: <raw> → <gzip>  *(app shell + router + all screens not lazy-split)*
- `react-vendor-<hash>.js`: <raw> → <gzip>
- `export-pipeline-<hash>.js`: <raw> → <gzip>  *(html-to-image/html2canvas + jsPDF — the client-side PNG/PDF export path, spec §4.3. Should be lazy-loaded from the editor's Download action, not pulled into the main entry, since Signup/Login/Dashboard never touch it.)*
- any other `manualChunks` groups defined in `vite.config.ts`

### Lazy screen chunks (if route-split via `React.lazy`)
| Screen | Raw | Gzip |
|--------|-----|------|
| Signup / Verify-Email Notice | | |
| Login / Forgot-Reset Password | | |
| Dashboard / Gallery | | |
| Profile / Company Settings | | |
| Card Editor (Format A) | | |
| Carousel Editor (Format B) | | |

### Warnings
- [ ] Chunk size warnings (any > 800 KB)
- [ ] Unused imports
- [ ] Type errors (should be zero — `tsc -b` runs first)
- [ ] Curated fonts (Plus Jakarta Sans + 6 others, spec §6.1) base64-inlined into the main entry instead of scoped to the export pipeline — 7 self-hosted variable-weight woff2 files inlined as base64 strings can add hundreds of KB wherever they land; confirm that only happens inside the lazy export-pipeline path, at export time, not eagerly at app load

### Deploy artifacts (Cloudflare Pages)
- [ ] `dist/_headers` present (cache-control rules)
- [ ] `dist/_redirects` present (SPA fallback, e.g. `/* /index.html 200`, so a hard refresh on `/dashboard` or `/editor/:id` doesn't 404)

### Budget guardrails
- Main entry gzip should stay < 200 KB
- `export-pipeline` chunk gzip should stay < 150 KB, and should load lazily (not part of the initial payload)
- Per-screen lazy chunk gzip should stay < 100 KB
- Total dist should stay < 5 MB
```

### 4. If anything's off

- Chunk too large → consider a `manualChunks` tweak in `vite.config.ts`, or `React.lazy`-split a screen/editor route
- TS error → fix in `app/src/`
- `export-pipeline` (html-to-image/html2canvas, jsPDF) or font base64 blobs showing up in `index-*.js` → check that these are only imported via a dynamic `import()` from the editor's Download action, not a top-level/static import anywhere reachable from the app shell
- Missing `_headers`/`_redirects` → check `app/public/`

## Useful commands

```bash
# Per-file sizes (sorted largest first)
ls -Sl dist/assets/*.js | head -15

# Quick grep for the main entry
ls dist/assets/index-*.js

# Sanity: export-pipeline libs should NOT appear in the main entry chunk
grep -l "html-to-image\|html2canvas\|jsPDF" dist/assets/index-*.js
# (a match here means they leaked into the main entry instead of their own lazy chunk)

# Sanity: no base64 font blobs leaked into the main entry
grep -c "data:font/woff2;base64" dist/assets/index-*.js

# Check gzip compression ratio
SIZE_RAW=$(wc -c < dist/assets/index-*.js)
SIZE_GZ=$(gzip -c dist/assets/index-*.js | wc -c)
echo "raw=$SIZE_RAW gzip=$SIZE_GZ ratio=$(echo "scale=2; $SIZE_GZ*100/$SIZE_RAW" | bc)%"
```

## Don't deploy from this skill

This is a pre-flight check only. ContentPro deploys straight from a push to `main` (path-filtered `app/**` build-then-deploy workflow, no `dev` branch, no auto-merge PR — see `docs/contentpro-spec.md`'s CI/CD notes). Run this locally first so a broken build never reaches that pipeline, let alone production.
