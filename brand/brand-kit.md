# Brand Kit — Cardstock

**Single source of truth** for the visual brand in this repo. There are **two** design systems here, and this file documents both — but they are deliberately separate, so read the right one:

> **Cardstock** is the product brand (logo, wordmark, UI). The repo, Worker, and database keep the original internal name `contentpro` — don't rename those.

1. **Cardstock Web App (current, primary)** — the self-service editor at `content.xahabcse.me` where end users design LinkedIn **cards** (1080×1080) and **carousels** (1080×1350). Mineral/glass UI with amber accents, `Archivo` / `Newsreader` / `Space Grotesk` type, 100 fixed templates, and 10 card palettes. Implemented under `app/src/`.
2. **Legacy `templates/` pipeline (Claude-driven, superseded)** — the original code-only pipeline (`templates/`, `scripts/render.js`, `posts/<slug>/content.json`) that renders posts from HTML/CSS with Playwright. It uses an **older mint-green / Plus Jakarta Sans** system carried over from learn.xahabcse.me. Kept for existing `posts/` but no longer the brand the product ships — see **Legacy Pipeline** at the bottom.

> If you're touching the web app, use **ContentPro Web App** below. The mint-green palette in the legacy section is NOT the ContentPro brand.

---

## ContentPro Web App — Design System (current)

The shipped brand. Keep this summary aligned with `app/src/styles/tokens.css`, `app/src/lib/palettes.ts`, and `app/src/lib/templates.ts` when changing the app.

### Surfaces & theme (app chrome)

App chrome (auth, dashboard, profile settings) is always light; source of truth is `app/src/styles/tokens.css` `:root`.

| Token | Hex / value | Role |
|-------|-------------|------|
| `--bg` | `#e9eeea` | Base mineral page color; `body` adds gradients |
| `--bar` | `#f9faf7` | Top bar base |
| `--surface` | `rgba(255, 255, 255, 0.54)` | Translucent cards and panels |
| `--surface-2` | `rgba(255, 255, 255, 0.76)` | Raised translucent surface |
| `--ink` | `#182725` | Primary dark-green text |
| `--muted` | `#566460` | Secondary text |
| `--muted-2` | `#3f504c` | Tertiary text |
| `--brand` | `#F2B705` | Amber accent — primary CTA, focus rings, active states |
| `--brand-ink` | `#1B160E` | Text on amber |
| `--brand-strong` | `#855d00` | Deeper amber for icons/text on light surfaces |
| `--danger` | `#E1402B` | Destructive actions (delete) |
| `--success` | `#12784A` | Positive/confirmation status (~5.1:1 on `--bar`) |
| `--line` | `rgba(24, 39, 37, 0.13)` | Hairline dividers |
| `--input` | `rgba(255, 255, 255, 0.78)` | Translucent form field background |

The **editor shell** (`.cp[data-ui="light" | "dark"]`) self-themes light/dark with a parallel `--c-*` token set (see `tokens.css`). The exported card/carousel uses its own **palette** tokens (below), independent of the editor chrome.

### Typography

Loaded from Google Fonts in `app/index.html`.

- **Display / headlines:** **Archivo** (weights 400–900). Big, tight, confident — used for card headlines, stats, dashboard titles.
- **Serif accent:** **Newsreader** (italic) — used for the Quote template and editorial flourishes (e.g. the landing hero).
- **UI / body:** **Space Grotesk** (400–700) — all interface text, labels, footer author/company lockups.

`--font-display: 'Archivo'`, `--font-ui: 'Space Grotesk'` (with system fallbacks). Never substitute Inter/Roboto/Arial.

### Card palettes

Every design picks one of ten curated palettes (`app/src/lib/palettes.ts`); each can override `bg` / `text` / `accent` with custom hex per design. These are the **canvas** colors (what the exported image uses), not the app chrome. New cards start with Paper; new carousels start with Ink.

| Palette | Background | Text | Accent |
|---------|-----------|------|--------|
| **Ink** | `#14110B` | `#F5F1E4` | `#F2B441` |
| **Paper** | `#F4EFE4` | `#1A1712` | `#B4531F` |
| **Slate** | `#24303A` | `#E9EEF2` | `#8FC0D4` |
| **Navy** | `#16233F` | `#EDF0F5` | `#D6A84C` |
| **Forest** | `#1B3A2E` | `#EAF0E4` | `#8FC98C` |
| **Wine** | `#3B1E27` | `#F4E6E8` | `#E39AA6` |
| **Sand** | `#E7DCC7` | `#2A2117` | `#A8481F` |
| **Charcoal** | `#1C1C1E` | `#FAFAFA` | `#B7B7BC` |
| **Cobalt** | `#21386E` | `#EEF1F8` | `#EBC258` |
| **Plum** | `#2E1F3F` | `#EFE6F5` | `#C79BE0` |

When a **background image** is set, the renderer forces text to `#FFFFFF` and lays a dark scrim gradient over the photo for legibility (`SlideCanvas.tsx`).

### Templates

There are 100 fixed templates, defined and ordered by `TEMPLATE_ORDER` in `app/src/lib/templates.ts` and rendered in `app/src/components/editor/SlideCanvas.tsx` and `CatalogCanvas.tsx`. A card uses one; a carousel sequences several. The library includes editorial layouts, tutorial and learning posts, charts and progress visuals, career milestones, business posts, and community messages. The `fields` metadata in `templates.ts` is the authoritative list of editable regions.

This is a **curated fixed-template** model: users pick a template and fill its regions; the canvas does not allow free-form placement.

### Canvas & formats

| Format | Size | Output |
|--------|------|--------|
| **Card** | 1080 × 1080 | single PNG |
| **Carousel** | 1080 × 1350 (portrait) | multi-page JPEG PDF or ordered PNG slides ZIP (1–15 slides) |

Export is **client-side** (`app/src/lib/export.ts`, html2canvas → PNG/PDF/ZIP) and downloads directly; nothing is uploaded. Filenames carry a timestamp so re-exports never collide.

### Footer lockup

Every rendered card/carousel slide ends with a two-part footer (`footer()` in `SlideCanvas.tsx`):

- **Author lockup (left):** circular avatar (or a generic person-icon placeholder when no photo) + name (falls back to "Your name") + `@handle` (falls back to "yourhandle") + designation.
- **Company lockup (right):** company logo (white-backed, rounded) + company name — auto-hidden if neither is set.

Defaults cascade from the user's **profile** (name, handle, photo, designation, company, logo); each design may override the author name/handle/photo just for that design. Empty fields auto-hide. A hairline divider sits above the row.

### Where it's implemented

| Path | Purpose |
|---|---|
| `app/src/styles/tokens.css` | All theme tokens (`:root` chrome + `.cp[data-ui]` editor light/dark) |
| `app/src/lib/palettes.ts` | The 10 card palettes + custom-override resolution |
| `app/src/lib/templates.ts` | Template metadata, field sets, default content |
| `app/src/components/editor/SlideCanvas.tsx` | The renderer (100 templates + footer, with `CatalogCanvas.tsx`) |
| `app/src/lib/export.ts` | Client-side PNG/PDF/ZIP export pipeline |
| `app/src/components/Logo.tsx` | Brand mark (amber tile + dog-eared card glyph) + wordmark lockup; the lockup collapses to the mark on landing-nav scroll |
| `app/public/favicon.svg` | Favicon (the brand mark) |
| `app/index.html` | Google Fonts (Archivo / Newsreader / Space Grotesk) + favicon + title |

### Accessibility

- Body/secondary text meets **WCAG AA 4.5:1** (`--muted` and darker); don't use `--muted` on amber or for tiny text without checking contrast.
- Interactive controls have visible `:focus-visible` rings; file inputs and the slide filmstrip are keyboard-operable.
- Decorative canvas images carry empty `alt`; status/error regions use `aria-live` / `role="alert"`.

---

## Legacy Pipeline — Claude-driven `templates/` (superseded)

> This is the **original** code-only pipeline that predates the ContentPro web app. It still renders `posts/<slug>/` via `node scripts/render.js posts/<slug>`, and its brand (mint-green + Plus Jakarta Sans, sourced from learn.xahabcse.me) is **different** from — and superseded by — the ContentPro brand above. Keep this section only for maintaining existing `posts/`; do not apply it to the web app.

### Formats (legacy)

| Format | Use for | Structure |
|---|---|---|
| **A — Single Card** | Short info, hot tech news, quick facts/tips | One 1080×1080 image (native image post) |
| **B — Carousel** | Big/detailed topic, multi-step explainer | 7–10 page PDF document carousel |

### Colors (legacy — mint-green, from learn.xahabcse.me)

| Token | Hex | Role |
|-------|-----|------|
| `bg-cover` | `#E7EFEA` | Cover / accent-page background (soft mint-green) |
| `bg-glow` | `#DBF0E2` | Soft-green corner glow |
| `bg-content` | `#FFFFFF` | Content-page background |
| `text-primary` | `#11221A` | Headlines + body (dark green-black) |
| `text-muted` | `#5E7369` | Secondary / caption / footer |
| `accent-green` | `#12A15C` | Brand primary — check icons, contact badges, CTA line |
| `accent-green-strong` | `#0A703F` | Eyebrow tag, handle text |
| `line` | `#D7EADD` | Hairline dividers |

### Typography (legacy)

- **Font:** **Plus Jakarta Sans** (variable 400–800), self-hosted in `brand/assets/fonts/`, loaded via `@font-face`. This is learn.xahabcse.me's font.
- **Title:** weight 800, UPPERCASE on the cover, tight line-height.
- **Body:** 400 (paragraphs) / 600 (bullets); bold lead-in + regular explanation.

### Footer convention (legacy single-line contact strip)

Each cover-style page (Format A card, Format B cover) ends with one horizontal footer: circular profile photo (56px) → four circular icon badges (Facebook/WhatsApp/Gmail/LinkedIn, accent-green) → shared handle **`@xahabcse`** (bold, accent-green-strong) → middle-dot → designation **"Software Engineer at OnnoRokom Projukti Limited"** (muted). Shared `FOOTER_ICONS_HTML` constant across `templates/single-card.html` and `templates/carousel-styles.css`.

### Rendering Pipeline (legacy)

Rendered in code — HTML/CSS templates screenshotted/printed by Playwright.

| Path | Purpose |
|---|---|
| `templates/single-card.html` | Format A template (`{{HEADLINE}}` etc.) |
| `templates/carousel-styles.css` | Format B styles — `.slide-cover` / `.slide-content` / `.slide-cta` |
| `scripts/render.js` | `node scripts/render.js posts/<slug>` |
| `brand/assets/profile-photo.jpg` | Headshot (circular via CSS) |
| `brand/assets/company-logo.jpg` | Company logo |
| `brand/assets/fonts/` | Self-hosted Plus Jakarta Sans `.woff2` |
| `posts/<slug>/content.json` | Per-post content |
| `posts/<slug>/output/` | `card.png` (A) or `carousel.pdf` + `page-NN.png` (B) |

**content.json — Format A (card):**

```json
{
  "format": "card",
  "eyebrow": "TECH NEWS",
  "headline": "...",
  "body": ["First paragraph.", "Second paragraph."],
  "handle": "@xahabcse",
  "designation": "Software Engineer at OnnoRokom Projukti Limited",
  "authorName": "Md Sahabuddin Hossain",
  "photo": "brand/assets/profile-photo.jpg"
}
```

**content.json — Format B (carousel):** a `slides` array of `cover` / `content` / `cta` types; only `cover` carries the footer.

```json
{
  "format": "carousel",
  "authorName": "Md Sahabuddin Hossain",
  "slides": [
    { "type": "cover", "headline": "...", "handle": "@xahabcse", "designation": "Software Engineer at OnnoRokom Projukti Limited" },
    { "type": "content", "heading": "...", "bullets": ["...", "..."] },
    { "type": "content", "heading": "...", "body": "..." },
    { "type": "cta", "heading": "...", "body": "...", "cta": "..." }
  ]
}
```

**Quality:** supersampled 2x by Playwright, downsampled to 1080×1080 with `sharp` (Lanczos3). Carousel PDF is native multi-page (`page.pdf()`, `printBackground:true`).

### Accuracy rule (applies to both systems)

Design only from the **content link** the user provides — never invent facts or stats beyond the source.

### Posting Checklist — Carousel (evidence-based, 2026 research)

> Format-agnostic LinkedIn tactics — apply to any carousel regardless of which pipeline rendered it. Derived from a multi-source research pass (Socialinsider 1.3M-post benchmark, Metricool, van der Blom's Algorithm Insights Report, LinkedIn engineering blog, creator case studies — July 2026). **PDF/Document carousel remains the reach ceiling for structured technical/educational content.**

- **Slide count:** target **7–10** (below 5 reads thin; above ~12–15 causes drop-off).
- **Cover slide:** design/test at **~375px mobile-thumbnail width**; headline **8–12 words** with a specific claim or number; treat slides 1–2 as a designed pair.
- **Content slides:** one idea per slide, **25–50 words / 6–8 lines**; if it looks like a textbook page, cut it.
- **CTA:** one CTA on the **final slide only**; prefer a comment-driving question over "follow me"; an optional soft "save this" nudge on slide 3–4 is fine.
- **Caption:** front-load the hook in the first 1–2 lines; **~800–1,200 chars**; end with a question.
- **Hashtags:** **0–3 max**, inline — more has been associated with worse reach.
- **Accessibility:** PDF upload has no per-slide alt-text; add a one-line plain-text summary of the deck in the caption; keep **4.5:1 contrast** on every slide.
- **File hygiene:** export a text-preserving PDF (not flattened raster); square (1080×1080) or portrait (1080×1350) — never landscape.
- **Hybridize:** pair select carousels with a 30–60s captioned native video teaser; for very dense topics consider a newsletter (bypasses the feed algorithm). Don't switch design tools for reach reasons — they all produce the same PDF.
