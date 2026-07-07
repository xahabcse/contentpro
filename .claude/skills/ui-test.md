---
name: ui-test
description: Run end-to-end UI tests on ContentPro (live or local) using Playwright MCP — signup + Turnstile, verify-email notice, login, forgot/reset password, dashboard/gallery limits, profile/company settings, card editor, carousel editor.
user_invocable: true
---

# UI Test Skill — ContentPro

Systematic UI verification of ContentPro (the LinkedIn card/carousel design SaaS) using Playwright MCP.

> **Sub-agent equivalent:** the `ui-tester` agent runs this same QA programmatically (read-only, returns a pass/fail + screenshot report, uses a dedicated ContentPro test account — never a real user's account, and never a real personal inbox for the mail-touching flows). Use the agent when delegating QA; use this skill to drive it interactively yourself.
>
> **Status note:** ContentPro's `app/`/`api/` code does not exist yet as of this writing — only `docs/contentpro-spec.md` does. This skill documents the QA checklist against that spec so it's ready to run screen-by-screen as each piece ships (§10's phased build plan), and to run in full once the whole flow is deployed.
>
> **Mail-testing gate (global rule, applies here):** Signup, Verify-Email Notice, and Forgot/Reset Password all send real email via Resend. Never auto-pick or reuse an already-authenticated inbox for these flows. Before running any test that will trigger a real signup/verification/reset email, **stop and ask the user which email address to use.** Form-validation-only checks (empty-field errors, Turnstile widget presence, etc.) don't need a real inbox and can run freely.

## Target

- **Production (Cloudflare Pages):** `https://contentpro.pages.dev` (or the custom domain once attached)
- **Production API (Cloudflare Workers):** `https://contentpro-api.<account-subdomain>.workers.dev`
- **Local dev (frontend):** `http://localhost:5173` (after `cd app && npm run dev`)
- **Local dev (API):** `http://localhost:8787` (after `cd api && npx wrangler dev`) — the frontend's `VITE_API_BASE_URL` must point here for local runs

## Page Taxonomy

Route paths below are illustrative (the router doesn't exist yet) — adjust to match the actual React Router config once implemented.

| Route (example) | Screen | Things to test |
|---|---|---|
| `/signup` | Signup | Email/password fields, Turnstile widget, submit → Verify-Email Notice |
| `/verify-email` | Verify-Email Notice | "Resend verification" action + cooldown, "login blocked until verified" copy, post-verify "log in again" prompt |
| `/login` | Login | Email/password; routes to Dashboard if `emailVerified` claim true, else back to Verify-Email Notice |
| `/forgot-password` → `/reset-password` | Forgot / Reset Password | Generic "check your email" response (no enumeration), new-password form from the emailed link |
| `/dashboard` | Dashboard / Gallery | Design cards + thumbnails, "Images: x/5" and "PDFs: y/5" counters, blocked state at 5/5, delete, duplicate |
| `/settings/profile` | Profile / Company Info Settings | Personal (name, designation, photo), company (name, logo), fixed 4 social icons + one shared handle field |
| `/editor/card/:id` | Card Editor (Format A) | Fixed regions, per-region font/size/color controls, soft length warnings, "Download PNG" |
| `/editor/carousel/:id` | Carousel Editor (Format B) | Slide navigator, cover/CTA pinning, add-slide cap, "Download PDF" |
| `/404` (unmatched) | Not Found | Any unknown URL |

## Test Flow

### 1. Signup (+ Turnstile)

- Navigate to `/signup` → expect email + password fields and a Cloudflare Turnstile widget
- **Ask the user for an email address first** (see mail-testing gate above) before submitting a real signup
- Submit with a missing/invalid field → inline validation errors, no request sent
- Submit valid form + solved Turnstile → redirects to Verify-Email Notice
- Note: Turnstile's challenge may not be solvable by an automated browser session — if so, verify the widget renders and blocks submission without a token, and skip past the actual solve

### 2. Verify-Email Notice

- Static "check your email" copy; explicit note that login is blocked until verified
- Click "Resend verification" → success; click again immediately → cooldown/rate-limit response (≈60s), still a generic message either way
- Only if the user has authorized use of a real inbox: open the emailed link, confirm `emailVerified` flips, and confirm the screen ends with a "log in again" prompt rather than auto-logging in

### 3. Login (verified vs. unverified branching)

- Log in with an unverified account → routed to Verify-Email Notice (client-side convenience redirect)
- Log in with a verified account → routed to Dashboard
- Security check: `browser_evaluate` → `document.cookie` must **not** contain the session JWT (proves the cookie is `httpOnly`, not just that one isn't visible by accident)
- Navigate directly to `/dashboard` with no session → redirected to `/login`

### 4. Forgot / Reset Password

- `/forgot-password`: submit a real-looking but nonexistent email, then (with permission) a real one → both return the identical generic "check your email" copy (no account-enumeration leak)
- Reset-password landing page (from the emailed link): new-password form → submit → success → redirected to Login
- Old password no longer works; new password does

### 5. Dashboard / Gallery (5+5 limit UI)

- Design cards render with client-rendered thumbnails (mini-render of `content`/`style`, not a stored image) — via `browser_network_requests`, confirm no request is made to a bare/public bucket URL for any thumbnail
- "Images: x/5" and "PDFs: y/5" counters visible and accurate
- At 5/5 for a type: the corresponding "create new"/export affordance is visibly disabled with explanatory copy (not silently blocked, not just missing)
- Delete a design → its slot frees immediately, counter decrements
- Duplicate ("save as new") a design → creates a genuinely new item, doesn't touch the original

### 6. Profile / Company Info Settings

- Personal: name, designation, profile-photo upload (`browser_file_upload`)
- Company: company name, logo upload
- Social: exactly 4 fixed icons (Facebook/WhatsApp/Gmail/LinkedIn) rendered read-only, plus one shared handle text field (e.g. `at-yourhandle`) — no per-platform fields, no platform toggle
- Save → reload → changes persisted
- With an incomplete profile (missing name/designation/handle), attempt "create new design" → redirected back here with explanatory copy, design not created

### 7. Card Editor (Format A)

- Open/create a card design → fixed regions render in fixed positions (eyebrow, headline, body, two-line footer) — confirm there is no drag handle, resize handle, or reposition affordance anywhere on the canvas
- Type into headline/body regions → canvas re-renders live, with nothing to "preview" separately
- Per-region style controls: font dropdown (7 curated fonts incl. Plus Jakarta Sans as default), size control limited to S/M/L only (not a free numeric input), color control (curated palette swatches + a "custom hex" escape hatch)
- Type a long headline (12+ words) → non-blocking soft warning appears near the field; typing/exporting still allowed
- Click "Download PNG" → a PNG downloads; confirm the autosave fired just before export
- At 5/5 on the image cap: "Download PNG" is blocked with an explanatory message rather than silently exporting

### 8. Carousel Editor (Format B)

- Open/create a carousel design → slide navigator shows cover (index 0) → content slides → CTA (last index); confirm neither cover nor CTA slide exposes a delete or retype control
- "Add slide" inserts a new content-type slide immediately before the CTA slide (no type selector shown)
- Content slide: toggle between "bullets with checkmarks" and "plain paragraph" modes
- Fewer than 5 slides → non-blocking soft warning shown
- Add slides up to 15 → "Add slide" becomes disabled at 15; confirm a 16th slide cannot be added under any circumstance
- Click "Download PDF" → a multi-page PDF downloads whose page count equals the slide count
- At 5/5 on the PDF cap: "Download PDF" is blocked with an explanatory message rather than silently exporting

### 9. Console errors & network spot-check

- On every screen visited, check `browser_console_messages level=error` → zero critical errors expected
- Via `browser_network_requests`, confirm every profile-photo/company-logo/exported-file fetch goes through an authenticated `/api/...` route — never a bare public R2 object URL
- If an unverified session's JWT is used against a Profile/Designs route directly, confirm the API responds `403 EMAIL_NOT_VERIFIED` (not just a client-side redirect)

## After Tests

### Report template

```md
## UI Test Report
**Site:** <URL> **Date:** YYYY-MM-DD **Commit:** <sha>

| Area | Result | Notes |
|------|--------|-------|
| Signup + Turnstile | ✅ / ❌ | ... |
| Verify-Email Notice | ✅ / ❌ | ... |
| Login (verified/unverified) | ✅ / ❌ | ... |
| Forgot / Reset Password | ✅ / ❌ | ... |
| Dashboard/Gallery (5+5 limits) | ✅ / ❌ | ... |
| Profile / Company Settings | ✅ / ❌ | ... |
| Card Editor (Format A) | ✅ / ❌ | ... |
| Carousel Editor (Format B) | ✅ / ❌ | ... |
| Console / network errors | ✅ / ❌ | N errors |

### Issues found
| Issue | Screen | Severity | Suggested fix |
|-------|--------|----------|----------------|

### Verdict: PASS / FAIL
```

### Fix workflow

If a test fails:

1. Identify root cause (usually a component under `app/src/components/` for editor/UI bugs, or a route handler under `api/src/routes/` for auth/limit/export-check bugs)
2. Fix the code
3. Frontend: `cd app && npm run build`, then `npx wrangler pages deploy dist --project-name=contentpro --branch=main --commit-dirty=true`
   API: `cd api && npx wrangler deploy` (deploys the `contentpro-api` Worker)
4. Re-test to confirm
5. Note: production deploys normally happen via push-to-`main` CI (path-filtered `app/**`/`api/**`, build-then-deploy, no dev branch) — the manual commands above are for a fast local fix/redeploy loop while iterating

## MCP tools used

- `mcp__playwright__browser_navigate`
- `mcp__playwright__browser_snapshot`
- `mcp__playwright__browser_click`
- `mcp__playwright__browser_type`
- `mcp__playwright__browser_fill_form`
- `mcp__playwright__browser_file_upload`
- `mcp__playwright__browser_take_screenshot` (pass a **bare filename** — the repo's Playwright MCP is configured with `--output-dir .playwright-mcp`, see `.mcp.json`)
- `mcp__playwright__browser_console_messages`
- `mcp__playwright__browser_network_requests`
- `mcp__playwright__browser_evaluate`
- `mcp__playwright__browser_resize`
- `mcp__playwright__browser_wait_for`
- `mcp__playwright__browser_close`
