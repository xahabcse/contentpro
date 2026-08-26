# ContentPro — Requirements Specification

**Status:** Final (post-grilling + adversarial review pass), v1 scope only
**Source repo evolved:** `xahabcse/contentpro` (currently a Claude-driven, code-only HTML/CSS + Playwright rendering pipeline: `templates/`, `scripts/render.js`, `brand/brand-kit.md`, `posts/SLUG/content.json`)

---

## 1. Overview

ContentPro is a self-service, multi-tenant web application that turns the existing `xahabcse/contentpro` repo — today a Claude-driven, code-only pipeline for rendering LinkedIn post designs via HTML/CSS templates and a Playwright script — into a product end users can operate entirely on their own, with no Claude, CLI, or code involved. It is for individual professionals and small teams who want to produce on-brand LinkedIn "single card" and "carousel" post designs (in the exact visual language already established by this repo's brand kit and templates) by registering an account, filling in their own personal/company profile once, pasting their own content into a fixed-layout live editor, lightly customizing font/size/color within a curated set of options, and exporting the result as a PNG or PDF — all rendered live in the browser via React, with no server-side headless-browser rendering step. The core value proposition is *"the same evidence-based, professionally-designed LinkedIn post templates this repo already produces via a code pipeline, but self-service, in a simple web UI, for any user — not just via Claude/CLI."*

---

## 2. Tech Stack

| Layer | Choice | Version / compat specifics |
|---|---|---|
| Frontend | React + Vite + TypeScript | Client-side rendering only — the React component tree *is* the live WYSIWYG editor/renderer (decision 1). No server-side Playwright/headless-Chromium anywhere in the product (Cloudflare Workers cannot run those). |
| Frontend hosting | Cloudflare Pages | Free tier |
| Backend API | Hono, on Cloudflare Workers | Free tier |
| Client-side export rendering | A DOM-to-canvas rasterization library (**`html-to-image`**, preferred; `html2canvas` is an acceptable alternative) for PNG rasterization, plus **`jsPDF`** for client-side multi-page PDF assembly | No server-side rendering involved (decision 1). See §4.3 for the full pipeline and font-embedding requirement. Flagged as a build risk item alongside the Mongo Durable Object — see §9. |
| Database | MongoDB Atlas, M0 (free) tier | Users, designs, and metadata documents. **Not** Cloudflare D1. |
| DB connectivity | Native MongoDB Node.js driver, run directly inside the Worker | Enabled by workerd's `node:net` / `node:tls` / `node:dns` support (shipped ~March 2025). Requires `compatibility_flags` including `nodejs_compat_v2` and `compatibility_date >= 2025-03-20`. **The MongoDB Atlas Data API is dead** (shut down Sept 30 2025) and must not be referenced or used anywhere in this build. The `MongoClient` is wrapped inside a single global **Cloudflare Durable Object** to keep the TCP/TLS connection warm/pooled across requests — see §4.2. |
| Rate-limit tracking store | **Workers KV** (a single namespace, e.g. `RATE_LIMIT_KV`) | Keyed by lowercased email; stores last-send timestamp + rolling hourly count with a TTL, backing the §5.3/§5.4 resend/reset cooldown and hourly cap. Chosen over Mongo because it's ephemeral, TTL-native data, not a durable record worth a Mongo write. |
| Password hashing | PBKDF2-HMAC-SHA256 via native Web Crypto (`crypto.subtle`) | No bcrypt/argon2/native `.node` addons anywhere (native bindings never load in Workers' V8 isolate — no `dlopen`, permanently unsupported per Cloudflare's own maintainers). See §5 for parameters. |
| Session/auth | JWT via `hono/jwt` (Web-Crypto backed) | Email + password auth (not Google OAuth — see §5). Stored client-side as an httpOnly cookie — see §5.2. |
| File storage (binaries) | Cloudinary | Free tier: 25 credits/month (~25GB storage+bandwidth combined). Signed upload + signed delivery URLs (§5.6) — not Cloudflare R2 (R2 setup was blocked on a manual dashboard step; Cloudinary was adopted instead, matching the pattern used by the sibling `protfolio` project). |
| Email delivery | Resend | Same provider as the reference "learning" project. `RESEND_API_KEY` stored as a Workers secret. |
| CAPTCHA | Cloudflare Turnstile | Free. On both the signup and login forms (§5.5). |
| Hosting (overall) | Cloudflare free tier, end to end, plus two non-Cloudflare managed services | Pages (frontend) + Workers (API) + Workers KV (rate limits) + Turnstile (bot defense) on Cloudflare; MongoDB Atlas M0 (database) and Cloudinary (file storage) are the two non-Cloudflare managed services. |

See §5.7 for the consolidated Workers secrets inventory.

---

## 3. Data Model

MongoDB Atlas, database e.g. `contentpro`. Two primary collections: `users` and `designs`. All monetary/limits/config values below are fixed v1 constants, not admin-configurable.

### 3.1 `users` collection

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | ObjectId | required | Mongo-generated |
| `email` | string | required | unique index; lowercase-normalized |
| `passwordHash` | string | required | PBKDF2-derived bits, base64/hex-encoded (see §5) |
| `passwordSalt` | string | required | random 16-byte salt, base64/hex-encoded, unique per user |
| `passwordIterations` | number | required | iteration count used at hash time (stored per-user so the count can be raised later without invalidating existing hashes) |
| `emailVerified` | boolean | required | default `false` at signup |
| `tokenVersion` | number | required | default `0`; incremented to invalidate all outstanding email-verification/password-reset JWTs (see §5) |
| `createdAt` | Date | required | |
| `updatedAt` | Date | required | |
| `profile.name` | string | optional (required before design creation — enforced server-side, see §4.1) | personal display name |
| `profile.designation` | string | optional (required before design creation — enforced server-side, see §4.1) | e.g. "Software Engineer at OnnoRokom Projukti Limited" |
| `profile.photoUrl` | string | optional | Cloudinary `secure_url` for the circular profile photo; null until uploaded |
| `profile.companyName` | string | optional | |
| `profile.companyLogoUrl` | string | optional | Cloudinary `secure_url` for the company logo badge |
| `profile.handle` | string | optional (required before design creation — enforced server-side, see §4.1) | the **one** shared handle text used under all 4 social icons, e.g. `at-xahabcse` (decision 16 — not per-platform). The literal text form `"at-xahabcse"` (not an `@`-glyph) is used deliberately, matching the repo's existing `content.json` convention and avoiding a duplicated `@`-style glyph rendering directly beneath the Gmail/LinkedIn icon badges. |
| `lastLoginAt` | Date | optional | |

Notes:

- The social-icon set itself is **not stored as user-configurable data** — it is a fixed constant of exactly 4 icons (Facebook, WhatsApp, Gmail, LinkedIn) rendered identically for every user, per decision 16. Only `profile.handle` (the one shared text) is user data.
- No roles/tiers/plans fields exist in v1 — every account has identical capabilities and identical limits (§7).
- Rate-limit counters for resend/reset (§5.3/§5.4) live in Workers KV, **not** on this document (see §2).

### 3.2 `designs` collection

A `design` document is the single, unified entity for both the editable design *and* its exported file, per decision 10 (a design and its export are the same unit, not a two-tier draft/export model). Re-editing and re-exporting an existing design overwrites this same document's `content`/`style` in place and uploads a fresh Cloudinary asset for the export (the prior asset is simply orphaned rather than overwritten in place — see §5.6); "make something new" is an explicit duplicate action that creates a brand-new document.

**Format ↔ output-type pairing (resolves a schema conflict flagged in review):** each design's `format` deterministically fixes its export output type — `"card"` designs always export as a single PNG image; `"carousel"` designs always export as a single multi-page PDF (matching how LinkedIn carousel posts are actually consumed, and avoiding an unworkable "N images in one document" shape). `format` cannot change after a design is created (only "duplicate as new" can produce a design of a different format); a design's editor screen therefore surfaces exactly one export button — "Download PNG" on the card editor, "Download PDF" on the carousel editor — rather than both buttons on every design. `fileType` is retained as a stored field (useful for the cap-count query in §7) but is fully derived from `format` at creation time and is immutable thereafter, so it can never drift out of sync.

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | ObjectId | required | |
| `userId` | ObjectId | required | owning user, indexed |
| `format` | string enum: `"card"` \| `"carousel"` | required | Format A (Single Card) or Format B (Carousel). Immutable after creation. |
| `title` | string | optional | user-facing label in the dashboard/gallery; defaults to a generated name if omitted |
| `content` | object | required | the editable design content — shape mirrors this repo's existing `content.json` schemas, ported to live editor state: for `card`, `{ eyebrow, headline, body: string[] }`; for `carousel`, `{ slides: [{ type: "cover"\|"content"\|"cta", headline?, heading?, bullets?, body?, cta? }] }`, subject to the structural constraint below |
| `style` | object | required | region-keyed style choices — see the `style` schema detail below |
| `fileType` | string enum: `"image"` \| `"pdf"` | required, derived | `"image"` for `card` designs, `"pdf"` for `carousel` designs — set once at creation from `format` and never independently editable (see pairing note above) |
| `export.url` | string | optional (present once exported) | Cloudinary `secure_url` of the generated binary (one binary per design — a single PNG for `card`, a single multi-page PDF for `carousel`) |
| `export.mimeType` | string | optional | `image/png` or `application/pdf` |
| `export.sizeBytes` | number | optional | |
| `export.pageCount` | number | optional | for carousel PDFs — number of slides (n/a for card PNGs) |
| `export.checksum` | string | optional | e.g. SHA-256 hex, for integrity/dedupe reference |
| `export.exportedAt` | Date | optional | |
| `createdAt` | Date | required | |
| `updatedAt` | Date | required | bumped on every content/style/export change |

**Carousel slide structural constraint (fixes a gap flagged in review — carries brand-kit.md's "single CTA on final slide only" checklist item into the spec):** `content.slides[0].type` is always `"cover"` and is pinned to index 0; `content.slides[slides.length - 1].type` is always `"cta"` and is pinned to the last index; every slide strictly between those two is `"content"`. Neither the cover nor the CTA slide can be deleted, reordered, or have its `type` reassigned. The "add slide" control (§6.2) always inserts a new `"content"`-type slide immediately before the CTA slide — there is no user-facing way to create a second cover slide, a second CTA slide, or a mid-carousel CTA slide. This is enforced structurally by the editor UI (no delete/retype affordance is ever shown for the cover or CTA slide, and "add slide" has no type selector) — it is a hard structural constraint, not a soft warning (contrast with the slide-*count* guardrail in §8, which is a mix of soft warning and hard cap).

**`style` schema (reworked from the original draft to actually carry "font, size, color" per region, per decision 13/15 and feature 6):**

```json
{
  "paletteId": "string — one of the ~6-8 curated brand-kit-derived palettes (see §6.1), or \"custom\" if any region below uses customHex",
  "regions": {
    "eyebrow":        { "font": "string", "size": "S|M|L", "colorToken": "string", "customHex": "string?" },
    "headline":       { "font": "string", "size": "S|M|L", "colorToken": "string", "customHex": "string?" },
    "body":           { "font": "string", "size": "S|M|L", "colorToken": "string", "customHex": "string?" },
    "footer":         { "font": "string", "size": "S|M|L", "colorToken": "string", "customHex": "string?" },

    "coverHeadline":  { "font": "string", "size": "S|M|L", "colorToken": "string", "customHex": "string?" },
    "contentHeading": { "font": "string", "size": "S|M|L", "colorToken": "string", "customHex": "string?" },
    "contentBody":    { "font": "string", "size": "S|M|L", "colorToken": "string", "customHex": "string?" },
    "ctaHeading":     { "font": "string", "size": "S|M|L", "colorToken": "string", "customHex": "string?" },
    "ctaBody":        { "font": "string", "size": "S|M|L", "colorToken": "string", "customHex": "string?" },
    "ctaLine":        { "font": "string", "size": "S|M|L", "colorToken": "string", "customHex": "string?" }
  }
}
```

- `regions.eyebrow` / `.headline` / `.body` / `.footer` apply to `card` designs; `regions.coverHeadline` / `.contentHeading` / `.contentBody` / `.ctaHeading` / `.ctaBody` / `.ctaLine` apply to `carousel` designs — only the keys relevant to the design's `format` are present/used.
- **Carousel region styling is scoped per region-*type*, shared across all slides of that type** (e.g. every `"content"` slide's heading shares one `contentHeading` style), not styled per individual slide instance — this keeps the control surface small, consistent with decision 13's "simple UI" mandate and decision 15's curation philosophy, rather than exploding into N-slides × M-regions of independent controls.
- `size` is a **curated 3-value preset** (`S`/`M`/`L`, mapped to fixed px values per region defined alongside the brand-kit tokens) rather than a free numeric input. Decision 15 explicitly curates font and color but is silent on size; this spec makes the size-curation call explicitly here, consistent with decision 15's spirit, rather than leaving "text size" (named directly in original feature 6) without a home in the data model.
- `colorToken` references a token from the palette selected by `paletteId` (e.g. `"text-primary"`, `"accent-green"`); `customHex` is the decision-15 escape hatch and, when set on a region, that region's effective color is the custom hex rather than the token.
- `font` is drawn from the curated list enumerated in §6.1 (no longer a single spec-wide field — each region can independently pick from the same curated list, though most users will leave every region on the palette/font default).

Indexes: `{ userId: 1, fileType: 1 }` (to efficiently enforce the 5/5 per-type cap in §7), `{ userId: 1, updatedAt: -1 }` (dashboard/gallery listing).

---

## 4. Backend Architecture

Hono app running on Cloudflare Workers. All routes below are namespaced under `/api`.

### 4.1 Route list

#### Auth

- `POST /api/auth/signup` — email, password, Turnstile token; creates user with `emailVerified: false`, sends verification email.
- `POST /api/auth/login` — email, password, Turnstile token (§5.5); validates credentials and, **regardless of `emailVerified` status**, issues a session JWT (set as an httpOnly cookie, §5.2) so the frontend can identify the account and route it appropriately. The JWT's payload includes an `emailVerified` claim reflecting status **at the moment of login** (see §5.3 for why this claim, not a live DB check, is the enforcement mechanism, and what that implies after a user verifies).
- `POST /api/auth/verify-email` — accepts the verification JWT (from the emailed link), validates, flips `emailVerified` to `true` in MongoDB, and prompts the user to log in again to obtain a fresh JWT carrying `emailVerified: true` (see §5.3).
- `POST /api/auth/resend-verification` — email; rate-limited via Workers KV (§2/§5.3), generic response regardless of account existence (see §5.3).
- `POST /api/auth/forgot-password` — email; sends password-reset email using the same token pattern as verification.
- `POST /api/auth/reset-password` — reset JWT + new password; validates, updates `passwordHash`/`passwordSalt`/`passwordIterations`, increments `tokenVersion`.

#### Profile

Every route below (and every Designs route) is gated by shared auth middleware that rejects the request with `403 EMAIL_NOT_VERIFIED` whenever the requesting JWT's `emailVerified` claim is `false` (see §5.3 — this is the actual enforcement of decision 6, not just the Login screen's client-side redirect).

- `GET /api/profile` — returns the current user's `profile.*` fields.
- `PUT /api/profile` — updates personal info (name, designation), company info (company name, company logo upload/replace), and the shared social handle.
- `POST /api/profile/photo` — uploads/replaces the profile photo via a signed Cloudinary upload (§5.6) and writes the resulting `secure_url` to `profile.photoUrl`.
- `POST /api/profile/logo` — uploads/replaces the company logo; same pattern, writes to `profile.companyLogoUrl`.
- `GET /api/profile/photo` — after verifying ownership, redirects to a signed Cloudinary delivery URL (§5.6) for the current user's profile photo.
- `GET /api/profile/logo` — same pattern for the company logo.

#### Designs

- `POST /api/designs` — create a new design (`format`, initial empty/starter `content`, default `style`). **First checks profile completeness**: `profile.name`, `profile.designation`, and `profile.handle` must all be non-empty (decision 16's fixed-field requirement); if any is missing, returns `400` with an error the frontend uses to redirect to Profile Settings ("Complete your profile before creating a design."). This is the only enforcement point for that requirement — once a design exists, its footer continues to live-reference whatever is currently in the user's profile (decision 5); if a user later blanks out a previously-filled profile field, existing designs simply render that footer field blank until the profile is completed again. This edge case is accepted as-is for v1, not separately guarded.
- `GET /api/designs` — list the current user's designs (dashboard/gallery), with enough metadata to render the 5+5 limit UI (§7) — counts of `fileType: "image"` vs `"pdf"` items. Thumbnails are **not** returned by this route as stored images (see §6 — they are produced by a client-side mini-render of `content`/`style`, since no schema field for a stored thumbnail exists or is needed).
- `GET /api/designs/:id` — fetch one design's full `content`/`style` for editing.
- `PUT /api/designs/:id` — update `content`/`style`. The editor **autosaves via a debounced call**: it fires ~2 seconds after the last edit, and also fires immediately on slide-navigation, region-blur, or immediately before a Download action — there is no explicit manual "Save" button. Overwrites in place per decision 10.
- `DELETE /api/designs/:id` — deletes the design document (decision 10), freeing one slot against the 5/5 cap. Does **not** also call Cloudinary's destroy API on the underlying asset (§5.6) — an accepted v1 tradeoff, matching the same non-deletion behavior `protfolio` already has for its own file records.
- `POST /api/designs/:id/duplicate` — explicit "save as new" action; creates a new document with copied `content`/`style` and no export yet.
- `POST /api/designs/:id/export` — server-side entry point that: (a) checks the requesting user still owns the design, (b) checks the relevant `fileType` count is `< 5` (blocking otherwise per decision 9 — see §7), (c) accepts the client-rendered binary (a single PNG for `card`, a single multi-page PDF for `carousel`, produced client-side per decision 1 and §4.3 — the Worker does not render it), uploads it to Cloudinary via a signed upload (§5.6), and writes/overwrites the design's `export.*` metadata fields with the resulting `secure_url`.
- `GET /api/designs/:id/download` — authenticated download route: verifies the requesting user's JWT session owns the design, then redirects to a signed Cloudinary delivery URL with the `fl_attachment` flag set (forcing a real "Save As" download with the design's title as filename, see §5.6). Not currently linked from any UI affordance — the editor downloads its own client-rendered blob directly (§4.3) and only POSTs it here for storage/record-keeping — but kept as the ownership-checked API surface for a future "re-download" action, consistent with decision 12 (no bare public object URL exists for any design's file).

### 4.2 The Durable Object wrapping MongoClient — a real, non-trivial build item

Because a bare per-request `MongoClient` connection is ~300ms–2s slower per request (fresh TCP/TLS handshake every time), all MongoDB access from every route above is routed through a single **Cloudflare Durable Object** ("Mongo Connection DO") rather than instantiating `MongoClient` directly inside each Worker request handler. **This is flagged explicitly as a real, non-trivial build item in its own right — not a one-line wrapper** — and should be scheduled and estimated as such (see §9 and §10).

Responsibilities / interface of the Mongo Connection DO:

- On first request (cold start), opens and caches a single `MongoClient` instance (with Atlas connection string from a Workers secret), keeping its TCP/TLS connection warm across subsequent requests routed to the same DO instance.
- Exposes an internal RPC-style interface to the rest of the Worker code — e.g. methods/message shapes for `findUser`, `insertUser`, `updateUser`, `findDesign`, `listDesignsForUser`, `insertDesign`, `updateDesign`, `deleteDesign`, `countDesignsByType` — rather than exposing the raw driver to route handlers, so all Mongo access is centralized and connection lifecycle is owned in one place.
- Handles reconnect/retry logic if the pooled connection drops (network blips, Atlas-side connection recycling), rather than letting a stale connection silently fail requests.
- **Sharding decision, committed for v1 (resolves an open question flagged in review):** a **single global DO instance** (a constant id, e.g. `idFromName("global-mongo-connection")`) handles all Mongo access for the entire app. This means all reads/writes serialize through one single-threaded object — an explicit, accepted v1 trade-off, in the same spirit as §5.1's PBKDF2 iteration trade-off. At expected v1 traffic (a free-tier, early-stage product with a 5-image/5-PDF per-user cap bounding total data volume), this is not expected to be the bottleneck: Atlas M0 itself caps at ~500 concurrent connections, and a single warm connection funneling serialized requests is well within that ceiling. If/when throughput requires it, the documented future path is sharding by a key such as `hash(userId) % N` across N DO instances, each with its own pooled `MongoClient`.
- Requires `compatibility_flags` including `nodejs_compat_v2` and `compatibility_date >= 2025-03-20` on the Worker (and therefore on the DO, since Durable Objects run inside the same Worker script/environment) — without this the `node:net`/`node:tls`/`node:dns` shims the native driver depends on are unavailable and the native MongoDB driver will not function.
- **Deployment note:** introducing a new Durable Object class requires a `[[migrations]]` block in `wrangler.toml` (e.g. `new_classes = ["MongoConnectionDO"]`) on first deploy — a near-guaranteed first-deploy stumbling block if omitted. This is called out explicitly here and in §10 step 1.
- Should be treated as a capability worth **extra integration testing** in its own right (see §9) — this pattern (native MongoDB driver + Durable Object pooling) is newer and less battle-tested than, e.g., a REST/Data-API-based integration would have been (had that still existed).

### 4.3 Client-side rendering & export pipeline — the other real, non-trivial build item

Decision 1 requires 100% client-side rendering with no server-side Playwright/headless-Chromium step. The mechanism by which the on-screen React tree actually becomes a downloadable PNG or PDF is specified here explicitly (this was previously hand-waved as "produced client-side," which review flagged as the single highest-risk unspecified item in the build):

- **PNG export (`card` designs):** the live card editor's DOM — the same React-rendered node tree used for on-screen WYSIWYG editing — is rasterized to a PNG at 1080×1080 using a DOM-to-canvas rasterization library (**`html-to-image`** preferred; `html2canvas` is an acceptable alternative), with devicePixelRatio-aware scaling so the exported PNG is crisp, not just a 1:1 screen capture.
- **PDF export (`carousel` designs):** each of the carousel's N slides is rendered off-screen (the same fixed 1080×1080 region components used on-screen, with the same font-embedding treatment below) and rasterized to a canvas per slide using the same library as above; the resulting per-slide canvases are then assembled into a single multi-page PDF client-side using **`jsPDF`** (one `addImage` call per page, 1080×1080 page size), producing one PDF whose `pageCount` equals the slide count.
- **Font-embedding requirement (a specific, named engineering requirement, not an afterthought):** before rasterization, every curated font in use (§6.1) — including the self-hosted, variable-weight Plus Jakarta Sans woff2 already in this repo — must be embedded as a **base64 `data:font/woff2;base64,...` URI inside an inline `@font-face` rule**, rather than referenced via a linked file. DOM-to-canvas rasterization libraries are well known to intermittently fail to pick up externally-linked webfonts that haven't finished a synchronous paint at capture time; base64-inlining removes that race condition entirely. This applies identically to all 7 curated fonts (§6.1), not just the default.
- Both pipelines run entirely in the browser main thread (or a Web Worker, if a build-time profiling pass shows main-thread jank on large 15-slide carousels) — no server is involved in rendering, consistent with decision 1.
- **Risk flag (see §9):** alongside the Mongo Durable Object (§4.2), this is the other genuinely non-trivial, less-battle-tested capability in this build. Self-hosted variable-weight webfont embedding in canvas rasterization is a known fragile point, and multi-page PDF assembly from N independently-rendered slide canvases has not yet been validated against this repo's exact templates/CSS. This should receive dedicated integration testing — comparing rendering fidelity against the existing Playwright-rendered reference output for the same `content.json` inputs — before being relied upon in production, the same way §4.2 flags the Mongo DO for extra scrutiny.

---

## 5. Auth and Security

### 5.1 Password hashing

- Algorithm: **PBKDF2-HMAC-SHA256**, via the native **Web Crypto `crypto.subtle`** API (`importKey` then `deriveBits`) — chosen specifically because it runs natively in the Workers V8 isolate.
- **Explicitly excluded:** bcrypt, argon2, or any package relying on native `.node` addons — these require `dlopen`, which is permanently unsupported in Workers per Cloudflare's own maintainers, and will never load in this runtime.
- Salt: random **16 bytes**, generated per user, stored alongside the hash (`passwordSalt`).
- Iterations: **~50,000–80,000** — a deliberate, documented trade-off *below* OWASP's current ~600,000-iteration PBKDF2-HMAC-SHA256 recommendation, chosen specifically to stay under the Workers free plan's **10ms CPU-time-per-request ceiling**. The exact count is stored per-user (`passwordIterations`) so it can be raised for new signups later without invalidating already-hashed passwords.
- Documented future hardening path (not v1 scope): if/when the project moves to **Workers Paid ($5/mo)**, its higher CPU budget would allow either raising PBKDF2 iterations well past 80,000, or switching to native `node:crypto` **scrypt**, which is a stronger memory-hard KDF than PBKDF2 at equivalent settings.

### 5.2 Session / JWT

- Auth mechanism is **email + password only** — no Google OAuth (a deliberate divergence from the reference "learning" project, which used Google OAuth only).
- Session tokens are **JWTs issued and verified via `hono/jwt`**, backed by Web Crypto — no session store needed beyond the JWT itself. Signed with a `JWT_SECRET` Workers secret (§5.7).
- **Storage location (resolves an implicit XSS/CSRF-relevant gap flagged in review):** the session JWT is set by the Worker as an **httpOnly, Secure, SameSite=Strict cookie** on signup/login/verify responses — **not** stored in `localStorage`/`sessionStorage`. `httpOnly` prevents the token being read by injected JS in an XSS scenario; `SameSite=Strict` mitigates CSRF for the same-site SPA+API pairing this product uses (Pages + Workers coordinated under a shared apex/subdomain). If the deployment topology ends up genuinely cross-site (Pages and Workers on unrelated domains rather than subdomains of one apex), `SameSite` would need to relax to `Lax` plus an explicit CSRF token on state-changing routes — a deployment-topology detail to confirm during build, not a v1 scope change.

### 5.3 Email verification

- Required before full account access (signup does not grant full access immediately).
- Pattern: a short-lived JWT (**30–60 min** expiry) with claims:

  ```json
  {
    "sub": "<userId>",
    "email": "<user email>",
    "type": "email_verification",
    "v": "<tokenVersion at issuance time>",
    "exp": "...",
    "iat": "..."
  }
  ```

- Verification is **pure CPU** (`jwt.verify`, no DB read needed to check the signature/expiry) followed by **one Mongo write**: flip `emailVerified` to `true`, but only if the token's `v` claim matches the user's current `tokenVersion` in MongoDB (guards against a stale/superseded link being used after a resend).
- **Enforcement mechanism, made explicit (resolves a gap flagged in review):** `POST /api/auth/login` issues a session JWT **regardless** of `emailVerified` status, so the frontend can identify the account and route it correctly — but that JWT's `emailVerified` claim is fixed at the moment of login. Every Profile and Designs route (§4.1) is gated by shared middleware that checks **this JWT claim**, not a fresh DB read, and rejects with `403 EMAIL_NOT_VERIFIED` when it is `false`. The Login screen's redirect to the Verify-Email Notice screen (§6) is a UX convenience layered on top of this — it is **not** the enforcement mechanism itself; a client hitting `/api/designs` directly with an unverified account's JWT is rejected server-side regardless of what the UI does. Because the claim is fixed at issuance, a user who verifies their email mid-session must **log in again** to receive a new JWT carrying `emailVerified: true` — the post-verification screen ends with a "log in again" prompt rather than silently unlocking the current session.
- Resend flow: increments `tokenVersion` (this instantly invalidates any prior outstanding verification links), always returns a **generic success message** regardless of whether the email exists (no email enumeration), and is **rate-limited** (~60 second cooldown between requests, ~5/hour cap per address), tracked in the **Workers KV `RATE_LIMIT_KV` namespace** (§2) keyed by lowercased email — not a Mongo field, since this is ephemeral, TTL-shaped data.
- Delivery: via **Resend**, using an **`Idempotency-Key` header** on the send call to avoid duplicate/double-sent emails, with `RESEND_API_KEY` stored as a Workers secret.

### 5.4 Password reset ("forgot password")

- Required in v1 (not deferred).
- Reuses the **exact same** JWT + `tokenVersion` + Resend mechanism as email verification — the only difference is the `type` claim value (e.g. `"password_reset"` instead of `"email_verification"`). This is explicitly *not* a separate, parallel mechanism — same expiry window, same `tokenVersion`-invalidation check, same generic-response/rate-limiting rules (same `RATE_LIMIT_KV` namespace, §5.3), same Resend + `Idempotency-Key` delivery path.
- On successful reset: update `passwordHash`/`passwordSalt`/`passwordIterations`, and increment `tokenVersion` again (invalidating the reset token itself and any other outstanding verification/reset links).

### 5.5 Turnstile (bot defense on signup and login)

- Signup is **open public signup** — anyone can register with an email (no invite-only/admin-allowlist, unlike the reference "learning" project's Google-OAuth-only + admin-allowlist pattern).
- Because signup is open, the signup form embeds **Cloudflare Turnstile** (Cloudflare's own free CAPTCHA product); `POST /api/auth/signup` validates the Turnstile token server-side (via Cloudflare's siteverify call, using the `TURNSTILE_SECRET_KEY` Workers secret, §5.7) before creating the user document, rejecting the request if validation fails.
- The login form embeds the same Turnstile widget; `POST /api/auth/login` validates the token the same way (after the per-email/per-IP rate-limit check, before the password check) so credential-stuffing against `/login` gets the same bot-defense layer as signup, not just the brute-force throttle (§5.3).
- Both pages share one `TurnstileWidget` component (`app/src/components/TurnstileWidget.tsx`) — script loading/polling, the dev-only bypass button, and `size: 'flexible'` sizing (so the widget matches the width of the surrounding form inputs) live in one place.

### 5.6 Cloudinary storage and signed-delivery pattern

**Revision note:** the original design used Cloudflare R2 with private bucket access. R2 bucket creation was blocked on a manual one-time dashboard step ("Please enable R2 through the Cloudflare Dashboard"), and rather than wait on that, storage was switched to **Cloudinary**, matching the exact fetch-based, `crypto.subtle`-signed pattern already used by the sibling `protfolio` project (no Cloudinary SDK — plain `fetch()` calls, signatures computed via Web Crypto, consistent with this project's existing "no native `.node` addons" constraint from §5.1).

- **Upload:** every upload (profile photo, company logo, design export) is a signed multipart `fetch()` to `https://api.cloudinary.com/v1_1/{cloud_name}/{resource_type}/upload`, with a SHA-1 signature computed over the sorted request params (`folder`, `timestamp`, `access_mode`, `exif`) plus the API secret. Uploads use `access_mode: "public"` (matching protfolio) — the resulting asset is reachable by anyone holding its URL; the real authorization boundary is that every route below ownership-checks the Mongo document before ever handing back a Cloudinary URL, not the asset's own access mode. This is a deliberate divergence from the original R2 design's "never a public bucket URL" framing (decision 12) — accepted as a v1 tradeoff for parity with protfolio's proven pattern, since a leaked URL is no more exposed than protfolio's own file records already are in production.
- **Delivery:** URLs returned to the client are passed through a **signed-delivery-URL** helper (ported from protfolio's `lib/cloudinaryDelivery.ts`) that inserts a `s--<signature>--` segment matching `cloudinary_npm`'s own `sign_url` logic (SHA-1, 8-char signature by default). This is applied at every response that includes a stored URL (profile GET/PUT/upload responses, design GET responses), not just at a dedicated redirect route.
- **Download filenames:** `GET /api/designs/:id/download` additionally inserts Cloudinary's `fl_attachment:<filename>` transformation flag before signing, so the browser performs a real "Save As" download with a sensible filename rather than an inline view.
- **Storage keys renamed accordingly:** `profile.photoR2Key`/`profile.companyLogoR2Key`/`export.r2Key` (R2 object keys) became `profile.photoUrl`/`profile.companyLogoUrl`/`export.url` (Cloudinary `secure_url` values) — see §3.1/§3.2.
- **No destroy-on-delete:** neither profile-image replacement nor `DELETE /api/designs/:id` calls Cloudinary's asset-destroy API — deleting a Mongo record simply orphans the underlying Cloudinary asset. This matches protfolio's own behavior (a soft-delete of the DB record only) and is an accepted v1 storage-hygiene tradeoff, not an oversight.

### 5.7 Workers secrets inventory (consolidated — resolves a gap flagged in review)

All of the following are stored as Cloudflare Workers secrets (never committed, never in client-visible config):

| Secret | Used by |
|---|---|
| `MONGODB_URI` | Mongo Connection DO (§4.2) — Atlas connection string |
| `JWT_SECRET` | Signing/verifying all session, email-verification, and password-reset JWTs (§5.2–§5.4) |
| `RESEND_API_KEY` | Email delivery via Resend (§5.3/§5.4) |
| `TURNSTILE_SECRET_KEY` | Server-side Turnstile siteverify call on signup and login (§5.5) |
| `CLOUDINARY_API_SECRET` | Signs Cloudinary uploads and delivery URLs (§5.6) |

`CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_API_KEY` are **not** secret by Cloudinary's own design (cloud name and API key are routinely client-visible in upload widgets) — they're plain `[vars]` in `wrangler.toml`, matching protfolio's own committed config, not listed in the secrets table above.

(The `RATE_LIMIT_KV` binding, §2, is a Worker **binding**, not a secret, but is listed here for completeness of the environment/deployment configuration a developer needs to wire up.)

---

## 6. Frontend Screens / Flow

| Screen | Purpose |
|---|---|
| **Signup** | Email + password form + Turnstile widget. On submit, calls `/api/auth/signup`, then routes to the Verify-Email Notice screen. |
| **Verify-Email Notice** | Static "check your email" screen shown post-signup (and shown again if a not-yet-verified user tries to log in); includes a "resend verification email" action (rate-limited per §5.3) and a note that login is blocked until verified. After the emailed link is clicked and verification succeeds, this flow ends with an explicit "log in again" prompt (§5.3) rather than silently unlocking the session. |
| **Login** | Email + password form + Turnstile widget (§5.5). On success, a session JWT is always issued (§5.3); if the JWT's `emailVerified` claim is `true`, routes to the Dashboard; if `false`, routes to the Verify-Email Notice screen instead (a UX convenience — the actual access gate is server-side middleware, §5.3, §4.1). |
| **Forgot Password / Reset Password** | Two-step flow: (1) email-entry form calling `/api/auth/forgot-password` (always shows a generic "check your email" response); (2) a reset-token landing page (from the emailed link) with a new-password form calling `/api/auth/reset-password`. |
| **Dashboard / Gallery** | Lists the current user's saved designs (cards from `GET /api/designs`), each showing format (card/carousel), title, a **thumbnail produced by a client-side mini-render** of that design's `content`/`style` through the same React component tree the editor uses (scaled down) — not a stored image and not fetched from Cloudinary, since un-exported drafts have no export asset and exported files are only ever handed out through the ownership-checked download route (decision 12, §5.6) — plus last-updated date and file type (image/PDF). Prominently shows the **5/5 image** and **5/5 PDF** usage counters (e.g. "Images: 3/5", "PDFs: 5/5"). When a type is at 5/5, the "create new" / "export" affordances for that type are visibly disabled/blocked with explanatory copy (see §7) rather than silently allowed. Supports opening a design into its editor, duplicating a design ("save as new"), and deleting a design (which frees a slot, per §7). |
| **Profile / Company Info Settings** | One settings screen covering the fixed field set from decision 16: personal (name, designation, profile photo upload), company (company name, company logo upload), and social (the 4 fixed icons — Facebook/WhatsApp/Gmail/LinkedIn, non-configurable — plus the single shared handle text field, e.g. `at-xahabcse`, used under all 4). No per-platform handle fields and no platform-selection toggle exist in v1 (explicitly deferred as a v2 nice-to-have). A first-time design-creation attempt with an incomplete profile (missing name/designation/handle) is redirected here with explanatory copy (§4.1). |
| **Card Editor (Format A)** | The live WYSIWYG editor for a Single Card design, ending in a single **"Download PNG"** button (§3.2's format↔output pairing) — see §6.1. |
| **Carousel Editor (Format B)** | The live WYSIWYG editor for a Carousel design, including per-slide navigation and the slide-count guardrails, ending in a single **"Download PDF"** button (§3.2's format↔output pairing) — see §6.2. |

There is **no separate "preview" page** anywhere in this flow (decision 18) — the editor screens themselves are the accurate live preview, since rendering is 100% client-side (decision 1). The Download button lives directly on the editor screen — one button per editor, matching that design's fixed output type (§3.2); decision 18 specifies that download controls live on the editor screen itself rather than a separate preview page, and does not mandate that every format expose both PNG and PDF — constraining each format to its one natural output type resolves a data-model conflict identified in review without touching the substance of decision 18. An optional "full-screen preview" **toggle** within the editor screen (hiding edit controls temporarily, without navigating away) may exist as a nice-to-have, but is not a required v1 route.

### 6.1 Editor interaction model — fixed regions + curated style controls (core UX)

Both editors (§6.1 card, §6.2 carousel) share the same interaction philosophy, per decision 13: this is a **fixed-layout templated editor**, directly reusing this repo's existing template regions/structure (ported from `templates/single-card.html` / `templates/carousel-styles.css` to live React components) — it is explicitly **not** a free-form drag/resize/reposition canvas, and there is no Fabric.js/Konva-style engine anywhere in the product. Concretely:

- The canvas shows the exact same regions as the existing HTML templates, in the exact same positions, at all times: for the card, the eyebrow tag, headline, 1–2 body paragraphs, and the two-line footer (profile photo + 4 social badges + shared handle on line 1; company logo badge + designation on line 2). These regions **cannot be moved, resized, or repositioned** — there is no drag handle, no free-text-box placement, no layering/z-index control.
- Each region is instead **filled in** via a simple, direct-manipulation form control mapped 1:1 to that region: click into the headline region to type/edit the headline text in place; a body-paragraph region has an "add paragraph" control (bounded by the template's existing 1–2 paragraph structure); footer fields (handle, designation) are edited via the Profile settings but the canonical source is the user's profile footer data (decision 5, feature 5: "Footer data comes from the user's profile, and is modifiable" — modifiable at the profile level, and reflected live into every design's footer).
- Once content is filled in, each region exposes a small, **curated** style-control panel (not a full property inspector): a font dropdown, a size control, and a color control, scoped only to that region — backed by the region-keyed `style.regions` schema in §3.2. Per decision 15, the **font list is a short fixed dropdown of exactly 7 professional fonts**, all self-hosted as woff2 (not a searchable Google-Fonts-style picker, and not a live Google Fonts CDN fetch, keeping the export font-embedding step in §4.3 reliable and offline-safe):
  - **Plus Jakarta Sans** — the repo's existing brand font; pre-selected as the default for every new design and every new profile.
  - Inter
  - Manrope
  - Sora
  - IBM Plex Sans
  - Work Sans
  - Poppins

  The **size control** offers a curated 3-value preset (Small / Medium / Large, mapped to fixed px values per region — see §3.2), not a free numeric input. **Colors are chosen from ~6–8 preset palettes** derived from `brand-kit.md`'s existing tokens (`bg`/`glow`/`text-primary`/`text-muted`/`accent-green`/`accent-green-strong`/`line`), **plus one "custom hex" advanced-option escape hatch** for users who want an exact off-palette color, applied per-region. There is no fully-open arbitrary color picker or Google Fonts search anywhere in the UI.
- As the user types/edits, the on-screen canvas re-renders live via the React component tree — what's shown at every keystroke **is** the final export (decision 1/18), so there is nothing to "preview" separately.
- Content-length soft warnings (§8) appear inline near the relevant region as the user types, without blocking further typing/editing.
- The **"Download PNG"** button (card editor) or **"Download PDF"** button (carousel editor) sits directly on this same editor screen (decision 18) and triggers the client-side rendering pipeline described in §4.3, then the export/save flow described in §4.1/§7.

### 6.2 Carousel-specific editor behavior

- A slide-navigator strip (thumbnails or a simple prev/next + slide list) lets the user move between the cover slide, content slides, and the CTA slide.
- Cover slide: uppercase headline field + the same footer region/controls as the card editor. Fixed at index 0; cannot be deleted, reordered, or retyped (§3.2).
- Content slides: a heading field, plus a per-slide toggle between "bullets with checkmarks" mode (repeatable bullet-line inputs) and "plain paragraph" mode — matching the two existing content-slide layouts in the template.
- CTA slide: heading, body, and a highlighted CTA line field. Fixed at the last index; cannot be deleted, reordered, or retyped (§3.2).
- "Add slide" control: enabled while slide count is below 15; **disabled entirely at 15 slides** (hard cap, decision 19) — the 16th slide cannot be added under any circumstance. It always inserts a new **content**-type slide immediately before the CTA slide (§3.2) — there is no type selector on "add slide."
- A soft warning (not blocking) appears if the carousel has fewer than 5 slides (decision 19, tied to §8's philosophy and brand-kit's 7–10 sweet spot).

---

## 7. Storage and Limits

- **Per-user cap:** each user may keep at most **5 images** and, separately, **5 PDFs** at any given time (decision 8) — this is a standing cap on currently-saved/exported items, **not** a lifetime/cumulative counter. Deleting an item frees a slot immediately. Because `format` deterministically fixes `fileType` (§3.2) and neither can change after creation, there is no scenario where a design's cap-type drifts mid-life — a `card` always counts against the image cap, a `carousel` always counts against the PDF cap.
- **Unified entity model (decision 10):** a design and its exported file are **the same entity/unit**, not a two-tier draft-vs-export model. Editing an existing design and re-exporting **overwrites/regenerates that same item's file in place** — it does not create a new item or consume an additional slot. Creating something genuinely new requires the explicit **"duplicate / save as new"** action (`POST /api/designs/:id/duplicate`), which does create a new item (and, once exported, will count against the relevant 5-item cap). Deleting a design removes its editable content and Mongo record; the exported Cloudinary asset is orphaned rather than actively destroyed (§5.6) — there is no way to delete only the content half and keep the export slot freed without also removing the record.
- **Limit-exceeded behavior (decision 9):** once a user is at 5/5 for a given file type (image or PDF), any **new** export/save attempt for that type is **blocked** — the API rejects it (`POST /api/designs/:id/export` returns a blocking error/response rather than performing the export) and the UI surfaces this clearly. The system does **not** auto-delete the oldest item silently to make room; the user must take an explicit, visible action.
- **Exact UI flow at the limit:**
  1. The Dashboard/Gallery screen always shows live counters, e.g. "Images: 5/5", "PDFs: 3/5".
  2. If the user attempts to export a new item of a type that is already at 5/5 (from the editor's single Download button, which is inherently tied to that design's format/fileType), the UI shows a clear blocking message — e.g. "You've reached your limit of 5 saved images. Delete an existing image to free up a slot before exporting a new one." — and does not perform the export.
  3. The user goes to the Dashboard/Gallery, reviews their existing items of that type, and explicitly deletes one (or more) via the delete action on a design card, which removes its content/record (per decision 10) and immediately frees a slot.
  4. The user returns to the editor and retries the export, which now succeeds since the count is below 5.
  - Re-exporting/overwriting an *existing* design's own file (editing it and re-downloading) is **not** subject to this block, since it does not create a new item under the unified entity model — only creating a genuinely new saved/exported item while already at 5/5 is blocked.

---

## 8. Content Guardrails

All guardrails below are tied to the exact evidence-based numbers already documented in this repo's `brand-kit.md` Posting Checklist, and are implemented as **non-blocking soft warnings**, except the carousel slide-count guardrail (soft warning + a separate hard cap) and the carousel slide-*structure* rule (a hard structural constraint, not a warning at all).

- **Headline length (soft warning only, decision 14):** brand-kit.md recommends a headline of **8–12 words** (a bold, specific claim/number). If the user's headline text exceeds this, the editor shows a visible, non-blocking warning near the headline field (e.g. "This headline may be a bit long — brand guidance suggests 8–12 words for the best mobile-thumbnail read.") but the user may proceed and export regardless.
- **Body/paragraph length (soft warning only, decision 14):** brand-kit.md recommends **~25–50 words per paragraph/bullet** (content slides: "Cap at 25–50 words / 6–8 lines"). If a body paragraph or bullet exceeds this, a similar soft, non-blocking "this may look crowded" style warning is shown inline near that region.
- **Hashtags (informational, not enforced in-app editor fields):** brand-kit.md's **0–3 hashtags, inline** guidance applies to the LinkedIn caption written at posting time (outside the exported image/PDF itself), so it is not a field this editor directly validates against, but is retained here as the same evidence-based source governing the other guardrails.
- **Carousel slide count (soft warning + separate hard cap, decision 19):** brand-kit.md's researched sweet spot is **7–10 slides** ("Below 5 reads as low-substance; above ~12–15 causes drop-off"). ContentPro implements this as:
  - A **soft warning** (non-blocking, consistent with decision 14's philosophy) if the carousel has **fewer than 5 slides**.
  - A **hard cap** at the top end: the "add slide" control **disables at 15 slides**, so a 16th slide can never be added under any circumstance — this caps meaningfully above the 7–10 research sweet spot (giving headroom) while still bounding the editor for UX/performance reasons.
- **Carousel slide *structure* — single CTA on final slide only (hard structural constraint, not a warning):** brand-kit.md's checklist also specifies a single CTA on the final slide only. Unlike the length/count guardrails above, this is not implemented as a warning a user can override — it is structurally impossible to violate, per the §3.2 constraint (cover pinned to index 0, CTA pinned to the last index, every other slide is content-type, "add slide" only ever inserts content-type slides).

---

## 9. Free-Tier Feasibility and Known Risks

- **CPU-time ceiling vs. password hashing (risk):** the Workers free plan enforces a strict **~10ms CPU-time-per-request** ceiling. PBKDF2 iteration count (§5.1) was deliberately tuned to **~50,000–80,000** — well below OWASP's ~600,000 recommendation — specifically to stay under this ceiling. This is a known, accepted, and documented security trade-off for v1, not an oversight; it should be re-evaluated (see §5.1's hardening path) if/when the project moves to Workers Paid.
- **Durable-Object-for-Mongo pattern is newer/less battle-tested (risk):** running the native MongoDB Node.js driver inside a Cloudflare Durable Object, relying on workerd's `node:net`/`node:tls`/`node:dns` shims (available since ~March 2025) plus `nodejs_compat_v2`, is a comparatively new capability combination as of this writing. It has not had the years of production hardening that, e.g., a conventional server-hosted Node/Mongo stack has. This pattern — and specifically the single global DO's serialization behavior under concurrent load, plus its connection-pooling/reconnect behavior under load and under Atlas-side connection limits (§4.2) — **should receive extra, deliberate integration testing** beyond what a more conventional stack would need, before being relied upon in production.
- **Client-side PNG/PDF rendering pipeline is equally new/less battle-tested (risk — elevated to first-class alongside the Mongo DO per review):** the combination of DOM-to-canvas rasterization (`html-to-image`/`html2canvas`) with base64-inlined self-hosted variable-weight webfonts, plus client-side multi-page PDF assembly via `jsPDF` (§4.3), has not yet been validated against this repo's actual templates. Font-embedding fragility and multi-page assembly correctness should be tested explicitly against the existing Playwright-rendered output as a fidelity baseline before this is relied upon in production.
- **Atlas M0 512MB total-storage ceiling (future watch-item):** MongoDB Atlas's free M0 tier caps **total storage at 512MB, shared across all app data** in that cluster (users, designs, and all metadata combined). Because actual PNG/PDF binaries are deliberately kept out of MongoDB entirely and instead live in Cloudinary (§2, §3 rationale — Atlas M0's cap plus BSON's 16MiB per-document cap made in-Mongo binary storage untenable), MongoDB itself only stores lightweight metadata/reference documents, which should keep usage well under 512MB for a good while. Still, this is flagged as a **future watch-item**: as the user base and per-user design count grow, total metadata volume should be monitored against the 512MB ceiling, since M0 has no automatic seamless scale-up path (a manual tier upgrade would be required).
- **Workers free-plan request ceiling (future watch-item, added per review):** the Workers free plan caps requests at **100,000/day**. Because gallery thumbnails are rendered client-side (§6, §4.3's philosophy) rather than fetched per-item from the Worker, the actual Worker call volume per user session is bounded to auth, profile, design CRUD (including the ~2-second debounced autosave, §4.1), export, and download calls — not a per-keystroke or per-thumbnail hit. This should comfortably fit v1's expected free-tier-scale user base, but is flagged as a watch-item to monitor (particularly the autosave call volume during long, active editing sessions) as usage grows.
- **Cloudinary free-tier credit ceiling + orphaned-asset growth (future watch-item, revised from the original R2 item):** Cloudinary's free tier is credit-metered (~25 credits/month, covering combined storage/bandwidth/transformations) rather than R2's separate storage/operations ceilings. Because neither profile-image replacement nor design deletion calls Cloudinary's destroy API (§5.6, an accepted parity tradeoff with protfolio), storage usage grows monotonically with re-uploads/re-exports even though the per-user 5-image/5-PDF **Mongo-record** cap (§7) stays bounded — the actual Cloudinary asset count is not equally bounded. Not expected to be a near-term constraint at v1 scale, but flagged as a watch-item: if usage grows, either start calling Cloudinary's destroy API on delete/re-export, or periodically prune orphaned assets via Cloudinary's admin API.

---

## 10. Phased Build Plan

This order takes advantage of the fact that this repo already has the visual template/brand-kit groundwork done (existing `templates/single-card.html`, `templates/carousel-styles.css`, `brand/brand-kit.md`, and the existing `content.json` schemas to port into live editor state), and sequences the genuinely new, riskier infrastructure (the Mongo Durable Object, the client-side export pipeline, Cloudinary signed storage, limits enforcement) after the foundational auth/profile layer is solid.

1. **Foundational infra plumbing:** stand up the Hono app on Cloudflare Workers with the correct `nodejs_compat_v2` flag and `compatibility_date >= 2025-03-20`; stand up the Mongo Connection Durable Object (§4.2) as its own tested unit before building routes on top of it, including its `wrangler.toml` `[[migrations]]` block (`new_sqlite_classes = [...]` on the free plan) on first deploy, given it's flagged as a non-trivial build item in its own right; connect to MongoDB Atlas M0; provision the `RATE_LIMIT_KV` namespace and a Cloudinary account (cloud name/API key/API secret).
2. **Auth + email verification + password reset:** signup (with Turnstile), login (issuing a JWT with an `emailVerified` claim regardless of status, per §5.3), PBKDF2 password hashing, JWT sessions stored as httpOnly cookies (§5.2), the email-verification JWT/`tokenVersion` flow via Resend with KV-backed rate limiting, and the password-reset flow reusing the same mechanism (§5). This is the highest-value, most security-sensitive layer and should be solid before any design features are built on top of it. Include the `EMAIL_NOT_VERIFIED`-rejecting middleware from the start, since Profile/Designs routes depend on it in step 3+.
3. **Profile / company-info settings:** the fixed personal/company/social field set (§3.1, §6), including profile-photo and company-logo upload to Cloudinary (signed upload/delivery pattern, §5.6, with the explicit `GET`/`POST` photo/logo routes from §4.1) — needed before real design content can reference footer data. Include the profile-completeness check that `POST /api/designs` will depend on in step 4.
4. **Card editor (Format A):** port `templates/single-card.html`'s regions into live React components per the fixed-region + curated-style-controls model (§6.1), using the region-keyed `style.regions` schema (§3.2); wire up `designs` collection CRUD (§4.1) for the `card` format, including the profile-completeness gate on creation and debounced autosave; implement the client-side PNG export pipeline (§4.3), including base64 font-embedding, as its own tested unit given its flagged risk status.
5. **Carousel editor (Format B):** port `templates/carousel-styles.css`'s slide types (cover/content/cta) into the same editor model with slide navigation (§6.2) and the structural cover/CTA-pinning constraint (§3.2); implement the client-side multi-page PDF export pipeline (§4.3); implement the 5-slide soft warning and 15-slide hard cap (§8/§19).
6. **Storage/limits enforcement + Cloudinary wiring:** implement the unified design=export entity model (§3.2, §7) end to end — export route's 5/5 per-type check and blocking behavior, Cloudinary asset upload with metadata written to Mongo, the authenticated download route/signed-delivery-URL pattern (§5.6), and the Dashboard/Gallery screen's live 5/5 counters, client-side-rendered thumbnails, and blocking UI (§7).
7. **Content guardrails polish:** wire up the soft-warning copy for headline/body length (§8) inline in both editors, using brand-kit.md's exact thresholds. (The carousel structural cover/CTA constraint is already enforced by construction in step 5, not added here.)
8. **Polish:** the optional full-screen preview toggle (§6, nice-to-have), general UX refinement, and a hardening/testing pass specifically targeted at the three flagged risk areas from §9 (CPU-time budget under real PBKDF2 load, the Mongo Durable Object's behavior under concurrent/failure conditions, and the client-side rendering pipeline's fidelity against the existing Playwright-rendered reference output).

---

**File locations:** saved at `d:\Exp-Work\Linkedin\docs\contentpro-spec.md` (project repo) and `C:\Users\OPL\AppData\Local\Temp\claude\d--Exp-Work-Linkedin\1e7a37c8-2f94-4308-83fd-eb7ff7a2e4c3\scratchpad\contentpro-spec-draft.md` (scratch copy — superseded by this revision).
