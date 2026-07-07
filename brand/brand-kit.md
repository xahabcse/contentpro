# Brand Kit — LinkedIn Post Style Spec

**Single source of truth** for every LinkedIn post designed in this repo. Keep all posts visually consistent with this spec — it is implemented directly as code in `templates/` (see **Rendering Pipeline** below), so "matching the brand kit" and "matching the template" are the same thing.

> Colors and fonts are sourced from **learn.xahabcse.me** (the "Porhi" site's real design tokens — extracted from its compiled CSS custom properties), and are locked in as literal CSS in `templates/single-card.html` and `templates/carousel-styles.css`. Layout/footer conventions were refined from an earlier Canva-based draft.

## Formats

Two post formats are used in this repo — pick based on content type:

| Format | Use for | Structure |
|---|---|---|
| **A — Single Card** | Short info, hot tech news, quick facts/tips | One 1080×1080 image, upload as a native image post (not a PDF document) |
| **B — Carousel** | Big/detailed topic, multi-step explainer | 7–10 page PDF document carousel — see Posting Checklist below |

### Format A — Single Card (quick / hot news)

- **Canvas:** 1080 × 1080 px (square), single static image — post as a regular native image, not a Document upload.
- **Content:** one concise fact/news item — a headline + at most 1–2 supporting lines. No multi-step content (that's Format B's job).
- **Footer:** circular-cropped profile photo (`brand/assets/profile-photo.jpg`, real headshot, `border-radius:50%` via CSS) + designation label **"Software Engineer"**, bottom corner — see the footer-label convention under Typography.
- Follows the same Colors / Typography / Layout rules as the rest of this brand kit.
- **Caption:** short, punchy, hook in the first 1–2 lines; end with a question to invite comments; **0–3 hashtags**, inline (same principles as the Format B Posting Checklist, scaled down — no slide/CTA structure applies here).

### Format B — Carousel (deep-dive topic)

- **Canvas:** 1080 × 1080 px (square)
- **Type:** multi-page PDF document carousel, **7–10 pages**
- **Page roles:** Cover → Content pages → CTA / outro
- Full tactical detail: see **Posting Checklist** below.

## Colors

Sourced from **learn.xahabcse.me**'s real CSS custom properties (`--bg`, `--ink`, `--amber`/brand, etc. — converted from HSL to hex):

| Token | Hex | Role |
|-------|-----|------|
| `bg-cover` | `#E7EFEA` | Cover / accent-page background (soft mint-green tint) |
| `bg-glow` | `#DBF0E2` | Soft-green gradient glow in a corner of the cover |
| `bg-content` | `#FFFFFF` | Content-page background |
| `text-primary` | `#11221A` | Headlines + body (dark green-black "ink") |
| `text-muted` | `#5E7369` | Secondary / caption / footer text |
| `accent-green` | `#12A15C` | Brand primary — check-circle icons, footer contact-icon badges, CTA highlight line |
| `accent-green-strong` | `#0A703F` | Eyebrow tag, handle text (darker green for small/bold text) |
| `line` | `#D7EADD` | Hairline dividers (e.g. footer divider) |

## Typography

- **Font family:** **Plus Jakarta Sans** (variable font, weights 400–800), self-hosted as a single local `.woff2` file in `brand/assets/fonts/` and loaded via `@font-face` — no internet dependency at render time. This is the actual font used by learn.xahabcse.me.
- **Title (cover + page headings):** weight **800**, **UPPERCASE** on the cover, tight line-height (~1.2–1.25).
- **Body:** weight **400** (paragraphs) or **600** (bullet items); a bold lead-in phrase followed by regular explanation reads well in checklist-style bullets.
- **Footer:** handle text is weight 700 in `accent-green-strong`; designation text is weight 500 in `text-muted`, both small (~19–22px) — see footer convention below.

## Layout rules

- Generous whitespace; never crowd the canvas.
- **Cover:** large UPPERCASE bold title (left-aligned), soft gradient background, thin decorative dash accent (top-right), single-line contact footer (see below).
- **Content page:** centered bold heading at top; body as a **left-aligned list with green check-circle icons**, or a plain paragraph for non-list explanations; each bullet = bold lead-in + regular sentence.
- Keep one idea per page; short lines; high contrast (dark ink on light background).

### Footer convention (single-line contact strip)

Every cover-style page (Format A card, Format B cover slide) ends with a single horizontal footer line, left to right:

1. Circular profile photo (56px, `brand/assets/profile-photo.jpg`, CSS `border-radius:50%`)
2. Four circular icon badges (Facebook, WhatsApp, Gmail, LinkedIn — generic simplified glyphs, not exact trademarked logos), accent-green background
3. Shared handle **`@xahabcse`** (bold, `accent-green-strong`) — one handle covers all platforms, not per-platform usernames/numbers
4. A middle-dot separator
5. Designation: **"Software Engineer at OnnoRokom Projukti Limited"** (muted, smaller)

A thin `line`-colored divider sits above this row. Implemented identically in `templates/single-card.html` and the `.slide-cover` footer in `templates/carousel-styles.css`/`scripts/render.js` (shared `FOOTER_ICONS_HTML` constant) — never duplicate this markup by hand, edit the shared source.

## Accuracy rule

Design only from the **content link** the user provides — do not invent facts or stats beyond the source.

## Rendering Pipeline

Every post is rendered **in code** — HTML/CSS templates, screenshotted/printed by a headless browser (Playwright), so there is no manual GUI step and no vendor tool limitation (no insert-text restriction, no crop-shape restriction — everything is real CSS).

| Path | Purpose |
|---|---|
| `templates/single-card.html` | Format A template (headline, body paragraph, footer) — placeholder tokens like `{{HEADLINE}}` |
| `templates/carousel-styles.css` | Format B shared styles — `.slide-cover` / `.slide-content` / `.slide-cta` |
| `scripts/render.js` | Renders a post: `node scripts/render.js posts/<slug>` |
| `brand/assets/profile-photo.jpg` | Personal headshot (circular-cropped via CSS at render time) |
| `brand/assets/company-logo.jpg` | Company logo, available for posts that need it |
| `brand/assets/fonts/` | Self-hosted Plus Jakarta Sans `.woff2` (single variable-weight file) |
| `posts/<slug>/content.json` | Per-post content — one file, drives the whole design |
| `posts/<slug>/output/` | Generated output: `card.png` (Format A) or `carousel.pdf` + `page-NN.png` (Format B) |

**content.json schema — Format A (card):**

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

`body` accepts either a single string (one paragraph) or an array of strings (multiple paragraphs, rendered as separate `<p>` blocks) — use 2 short paragraphs for a professional, non-thin feel on Format A.

**content.json schema — Format B (carousel):** a `slides` array, each with a `type` of `cover` / `content` / `cta`. Only the `cover` slide carries the footer (`handle` + `designation`, same convention as Format A):

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

**Quality:** every export is supersampled at 2x by Playwright, then downsampled to the exact target size (1080×1080) with `sharp` using Lanczos3 resampling — crisp text and edges, no blur. The carousel PDF is native multi-page (`page.pdf()` with `printBackground:true`), suitable for LinkedIn's "Document" post upload as-is.

**To render a new post:** create `posts/<slug>/content.json`, then run `node scripts/render.js posts/<slug>`.

## Posting Checklist — Format B / Carousel (evidence-based, 2026 research)

> Derived from a multi-source research pass (Socialinsider 1.3M-post benchmark, Metricool, van der Blom's Algorithm Insights Report, LinkedIn's own engineering blog, Buffer/Adweek/Indie Hackers creator case studies — July 2026). **Verdict: PDF/Document carousel remains the reach ceiling for structured technical/educational content — keep it as the primary format.** Apply these tactics to every carousel before publishing.

### Slide count

- Target **7–10 slides** (converged sweet spot across independent sources). Below 5 reads as low-substance; above ~12–15 causes drop-off.

### Cover slide (the hook)

- Design and test at **~375px mobile-thumbnail width** — the actual in-feed render size — not just full 1080px resolution.
- Headline: **8–12 words**, a bold *specific* claim or number, not a generic label (e.g. "3 SQL Index Types That Cut Query Time 10x" beats "SQL Indexing Tips").
- Treat slide 1 and slide 2 as a designed pair — card 2 is often partially visible in-feed before a click.

### Content slides

- **One idea per slide.** Cap at **25–50 words / 6–8 lines**. Headline ≥ 40–48pt-equivalent, body ≥ 24pt-equivalent on the 1080px canvas.
- If a slide "looks like a textbook page," cut it.

### CTA

- **One CTA, on the final slide only.** Never place a follow/comment ask mid-deck — it kills completion rate.
- Prefer a **comment-driving question** over a generic "follow me" — comments carry outsized algorithmic weight (re-notifies the commenter's network).
- An optional soft "save this" nudge on slide 3–4 is fine.

### Caption (accompanying post text)

- Front-load the hook in the **first 1–2 lines** — LinkedIn truncates with "see more."
- Total length **~800–1,200 characters / 100–200 words**. End with a question to invite comments.

### Hashtags

- **0–3 max**, placed inline — never stacked at the end. More than 3 has been associated with materially worse reach; LinkedIn's ranking reportedly reads post text directly now, so hashtags carry little independent value.

### Accessibility (currently an unaddressed gap — mitigate, don't ignore)

- The native PDF Document upload has **no per-slide alt-text field**, and LinkedIn's OCR-based "Accessibility Mode" is unreliable (wrong reading order, missing descriptions).
- Mitigate: add a **one-line plain-text summary** of the deck's content in the caption; maintain **4.5:1 contrast ratio (WCAG AA)** on every slide.

### File hygiene

- Export as a **vector/text-preserving PDF**, not a flattened raster — avoids LinkedIn's compression blurring small text.
- Canvas: **square (1080×1080, current default) or portrait (1080×1350)** — never landscape (hurts mobile legibility).

### Hybridize, don't replace

- Pair select carousels with a **30–60s native video teaser** highlighting the single most surprising slide/claim, captioned (most LinkedIn video is watched muted) — captures video's reach-growth momentum without abandoning the carousel's depth.
- For topics too dense for 8–10 slides, consider a **recurring newsletter** — it bypasses the feed algorithm entirely (direct email/push/in-app delivery to subscribers) rather than competing with it.
- Don't switch design tools (Figma/PowerPoint/Beautiful.ai/Pitch) for reach reasons — they all produce the same PDF output competing for identical algorithmic treatment. Only switch if team review workflow, not reach, is the actual bottleneck.
