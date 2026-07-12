// Resend email delivery (spec sections 5.3/5.4) -- verification + password
// reset share this one send helper; every call carries an Idempotency-Key
// header so a client retry never double-sends the same email.
//
// The two transactional emails are rendered from a single, brand-consistent
// HTML shell (renderBrandedEmail) so header/footer/button styling never
// drifts between them. Everything is email-client-safe: table-based layout,
// all styles INLINE (the small <style> block only adds optional niceties and
// nothing depends on it), no external CSS, no webfonts (email clients can't
// load Archivo reliably -> web-safe stack). Brand = Cardstock.

const RESEND_API_URL = "https://api.resend.com/emails";

// Cardstock brand tokens (mirrors brand/brand-kit.md; repeated here so the
// email layer has no cross-package import).
const BRAND = {
  amber: "#F2B705",
  ink: "#1B160E",
  cream: "#EFE8D8",
  creamLight: "#FBFAF6", // near-white cream, used for the wordmark on the dark header
  creamDim: "#C9BFA6", // dimmed cream for the header subtitle
  muted: "#6F6750",
  card: "#FBF7EC",
  border: "#E3D9C2",
} as const;

// Web-safe stacks -- Archivo/Newsreader webfonts don't load reliably in email
// clients. Sans for body/UI; serif for the editorial wordmark accent.
const FONT_STACK = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
const SERIF_STACK = `Georgia, "Times New Roman", Times, serif`;

export interface ResendConfig {
  apiKey: string;
  from: string;
  frontendUrl: string;
}

interface SendEmailParams {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
}

async function sendEmail(params: SendEmailParams): Promise<void> {
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": params.idempotencyKey,
    },
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`Resend send failed: ${res.status} ${body}`);
    throw new Error("Failed to send email");
  }
}

/** last 32 chars of the token is plenty of entropy for a per-send idempotency key */
function idempotencyKeyFor(scope: string, email: string, token: string): string {
  return `${scope}:${email.toLowerCase()}:${token.slice(-32)}`;
}

// ---------------------------------------------------------------------------
// branded HTML shell
// ---------------------------------------------------------------------------

/** Escape untrusted text for safe embedding in HTML text/attribute contexts. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface BrandedEmailOptions {
  /** Hidden inbox-preview text shown before the body is opened. */
  preheader: string;
  /** UPPERCASE amber eyebrow in the dark header, e.g. "VERIFY YOUR EMAIL". */
  eyebrow: string;
  /** Big friendly heading, e.g. "Verify your email". */
  heading: string;
  /** One or two short intro sentences (already plain text -- escaped here). */
  paragraphs: string[];
  /** CTA button label. */
  buttonLabel: string;
  /** Destination URL -- MUST stay intact (the token lives in ?token=). */
  url: string;
  /** Frontend base URL -- powers the footer "Open Cardstock" / "About" pills. */
  frontendUrl: string;
}

/**
 * Renders the shared Cardstock email: a dark ink header band (amber eyebrow +
 * serif "Cardstock." wordmark + subtitle), a light cream card body with the
 * caller's copy, a bulletproof amber CTA button, a selectable plain-link
 * fallback, expiry + ignore notes, and a footer with brand line, secondary
 * pill links, and the automated-message note.
 */
function renderBrandedEmail(options: BrandedEmailOptions): string {
  const safeUrl = escapeHtml(options.url);
  const homeUrl = escapeHtml(options.frontendUrl.replace(/\/+$/, ""));
  const aboutUrl = `${homeUrl}/about`;
  const year = new Date().getFullYear();

  const bodyParagraphs = options.paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 16px; font-family:${FONT_STACK}; font-size:16px; line-height:1.6; color:${BRAND.ink};">${escapeHtml(
          text,
        )}</p>`,
    )
    .join("");

  // Subtle outline pill for the footer secondary links.
  const pill = (href: string, label: string): string =>
    `<a href="${href}" target="_blank" rel="noopener" style="display:inline-block; padding:8px 16px; font-family:${FONT_STACK}; font-size:12px; font-weight:600; color:${BRAND.ink}; text-decoration:none; border:1px solid ${BRAND.border}; border-radius:999px;">${escapeHtml(
      label,
    )}</a>`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light only" />
<title>${escapeHtml(options.heading)}</title>
<style>
  /* Optional niceties only -- the layout is fully inlined and works without this. */
  a.cs-btn:hover { filter: brightness(0.95); }
  @media (max-width: 600px) {
    .cs-card { width: 100% !important; }
    .cs-pad { padding-left: 24px !important; padding-right: 24px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:${BRAND.cream}; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  <!-- preheader: hidden inbox preview text -->
  <span style="display:none !important; visibility:hidden; mso-hide:all; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; color:transparent;">${escapeHtml(
    options.preheader,
  )}</span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${
    BRAND.cream
  };">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" class="cs-card" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px; max-width:560px; background-color:${
          BRAND.card
        }; border:1px solid ${BRAND.border}; border-radius:16px; overflow:hidden;">

          <!-- dark header band (bgcolor on td so Outlook fills it too) -->
          <tr>
            <td align="center" bgcolor="${BRAND.ink}" class="cs-pad" style="background-color:${
              BRAND.ink
            }; padding:40px 40px; border-top-left-radius:16px; border-top-right-radius:16px;">
              <!-- Use <p>/<h1> (not <div>) here: Gmail strips inline styles off
                   <div>s in this position, which turned the light header text
                   invisible on the dark band; <p>/<h1> inline styles survive. -->
              <p style="margin:0 0 10px; font-family:${FONT_STACK}; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.18em; color:${
                BRAND.amber
              };">${escapeHtml(options.eyebrow)}</p>
              <h1 style="margin:0; font-family:${SERIF_STACK}; font-size:36px; line-height:1.1; font-weight:700; color:${
                BRAND.creamLight
              };">Cardstock.</h1>
              <p style="margin:8px 0 0; font-family:${FONT_STACK}; font-size:13px; color:${
                BRAND.creamDim
              };">LinkedIn card &amp; carousel studio</p>
            </td>
          </tr>

          <!-- body -->
          <tr>
            <td class="cs-pad" style="padding:36px 40px 8px;">
              <h1 style="margin:0 0 16px; font-family:${FONT_STACK}; font-size:24px; line-height:1.3; font-weight:800; color:${
                BRAND.ink
              };">${escapeHtml(options.heading)}</h1>
              ${bodyParagraphs}
            </td>
          </tr>

          <!-- bulletproof CTA button -->
          <tr>
            <td class="cs-pad" style="padding:12px 40px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="${
                    BRAND.amber
                  }" style="border-radius:10px;">
                    <a class="cs-btn" href="${safeUrl}" target="_blank" rel="noopener" style="display:inline-block; padding:15px 32px; font-family:${FONT_STACK}; font-size:16px; font-weight:700; line-height:1; color:${
                      BRAND.ink
                    }; text-decoration:none; border-radius:10px;">${escapeHtml(
                      options.buttonLabel,
                    )} &rarr;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- plain-link fallback (kept selectable + intact for ?token=) -->
          <tr>
            <td class="cs-pad" style="padding:16px 40px 0;">
              <p style="margin:0 0 6px; font-family:${FONT_STACK}; font-size:13px; color:${
                BRAND.muted
              };">Button not working? Paste this link into your browser:</p>
              <p style="margin:0; font-family:${FONT_STACK}; font-size:13px; line-height:1.5; word-break:break-all;">
                <a href="${safeUrl}" target="_blank" rel="noopener" style="color:#8A6D0B; text-decoration:underline;">${safeUrl}</a>
              </p>
            </td>
          </tr>

          <!-- expiry + ignore notes -->
          <tr>
            <td class="cs-pad" style="padding:20px 40px 4px;">
              <p style="margin:0 0 8px; font-family:${FONT_STACK}; font-size:13px; color:${
                BRAND.muted
              };">This link expires in 45 minutes.</p>
              <p style="margin:0; font-family:${FONT_STACK}; font-size:13px; color:${
                BRAND.muted
              };">If you didn&#39;t request this, you can safely ignore this email.</p>
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td class="cs-pad" style="padding:28px 40px 32px;">
              <div style="height:1px; line-height:1px; font-size:1px; background-color:${
                BRAND.border
              }; margin-bottom:20px;">&nbsp;</div>
              <p style="margin:0 0 16px; font-family:${FONT_STACK}; font-size:13px; line-height:1.5; color:${
                BRAND.ink
              };"><strong style="font-weight:800;">Cardstock</strong> &mdash; design LinkedIn cards &amp; carousels</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
                <tr>
                  <td style="padding-right:8px;">${pill(homeUrl, "Open Cardstock")}</td>
                  <td>${pill(aboutUrl, "About")}</td>
                </tr>
              </table>
              <p style="margin:0; font-family:${FONT_STACK}; font-size:12px; line-height:1.5; color:${
                BRAND.muted
              };">Automated message from a send-only address &mdash; please don&#39;t reply.<br />&copy; ${year} Cardstock</p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// public senders
// ---------------------------------------------------------------------------

export async function sendVerificationEmail(
  email: string,
  token: string,
  config: ResendConfig,
): Promise<void> {
  const link = `${config.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    apiKey: config.apiKey,
    from: config.from,
    to: email,
    subject: "Verify your Cardstock email address",
    html: renderBrandedEmail({
      preheader: "Confirm your email to start creating LinkedIn cards & carousels with Cardstock.",
      eyebrow: "Verify your email",
      heading: "Verify your email",
      paragraphs: [
        "Welcome to Cardstock! You're one click away from designing polished LinkedIn cards and carousels.",
        "Confirm this is your email address to activate your account.",
      ],
      buttonLabel: "Verify email address",
      url: link,
      frontendUrl: config.frontendUrl,
    }),
    idempotencyKey: idempotencyKeyFor("email-verification", email, token),
  });
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  config: ResendConfig,
): Promise<void> {
  const link = `${config.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    apiKey: config.apiKey,
    from: config.from,
    to: email,
    subject: "Reset your Cardstock password",
    html: renderBrandedEmail({
      preheader: "Choose a new password for your Cardstock account.",
      eyebrow: "Password reset",
      heading: "Reset your password",
      paragraphs: [
        "We received a request to reset the password for your Cardstock account.",
        "Click the button below to choose a new one.",
      ],
      buttonLabel: "Choose a new password",
      url: link,
      frontendUrl: config.frontendUrl,
    }),
    idempotencyKey: idempotencyKeyFor("password-reset", email, token),
  });
}
