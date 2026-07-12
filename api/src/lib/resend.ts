// Resend email delivery (spec sections 5.3/5.4) -- verification + password
// reset share this one send helper; every call carries an Idempotency-Key
// header so a client retry never double-sends the same email.
//
// The two transactional emails are rendered from a single, brand-consistent
// HTML shell (renderBrandedEmail). Its structure deliberately mirrors the
// learning/Porhi template that renders cleanly in this exact Gmail account:
// a MINIMAL <head> (charset + viewport only), NO <style> block / color-scheme
// / title / x-apple metas (those trip Gmail's sanitizer, which was stripping
// the inline `style` attribute off block elements and killing header/CTA
// colors), and NO single overflow:hidden card wrapper -- instead each section
// is its own <tr><td> with its own `background:` shorthand + corner radii.
// Everything stays inline + table-based; no webfonts. Brand = Cardstock.

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
  /** UPPERCASE amber eyebrow in the dark header, e.g. "Verify your email". */
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
 * Renders the shared Cardstock email: dark ink header band (amber eyebrow +
 * serif "Cardstock." wordmark + subtitle), a light cream card body with the
 * caller's copy + amber CTA + plain-link fallback + notes, and a footer with
 * brand line, secondary pill links, and the automated-message note. See the
 * file header for why the head/structure are intentionally minimal.
 */
function renderBrandedEmail(options: BrandedEmailOptions): string {
  const safeUrl = escapeHtml(options.url);
  const homeUrl = escapeHtml(options.frontendUrl.replace(/\/+$/, ""));
  const aboutUrl = `${homeUrl}/about`;
  const year = new Date().getFullYear();

  const bodyParagraphs = options.paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${BRAND.ink};font-family:${FONT_STACK};">${escapeHtml(
          text,
        )}</p>`,
    )
    .join("");

  // Footer pills -- inline-styled <a>s (which survive Gmail, matching Porhi's
  // footer button row). Filled ink primary + outline secondary.
  const pillPrimary = (href: string, label: string): string =>
    `<a href="${href}" target="_blank" rel="noopener" style="display:inline-block;background:${BRAND.ink};color:${BRAND.creamLight};font-size:12px;font-weight:600;text-decoration:none;padding:8px 16px;border-radius:999px;font-family:${FONT_STACK};">${escapeHtml(
      label,
    )}</a>`;
  const pillOutline = (href: string, label: string): string =>
    `<a href="${href}" target="_blank" rel="noopener" style="display:inline-block;background:${BRAND.card};color:${BRAND.ink};font-size:12px;font-weight:600;text-decoration:none;padding:8px 16px;border:1px solid ${BRAND.border};border-radius:999px;font-family:${FONT_STACK};">${escapeHtml(
      label,
    )}</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:${BRAND.cream};font-family:${FONT_STACK};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(
    options.preheader,
  )}</span>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${
    BRAND.cream
  };padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;">

          <!-- dark header band -->
          <tr>
            <td style="background:${BRAND.ink};border-radius:16px 16px 0 0;padding:40px 40px;text-align:center;">
              <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:${
                BRAND.amber
              };font-weight:700;font-family:${FONT_STACK};">${escapeHtml(options.eyebrow)}</p>
              <h1 style="margin:0;font-size:36px;line-height:1.1;font-weight:700;color:${
                BRAND.creamLight
              };font-family:${SERIF_STACK};">Cardstock.</h1>
              <p style="margin:8px 0 0;font-size:13px;color:${
                BRAND.creamDim
              };font-family:${FONT_STACK};">LinkedIn card &amp; carousel studio</p>
            </td>
          </tr>

          <!-- body: heading + copy + CTA + fallback + notes -->
          <tr>
            <td style="background:${BRAND.card};padding:36px 40px 8px;">
              <h2 style="margin:0 0 16px;font-size:23px;line-height:1.3;font-weight:800;color:${
                BRAND.ink
              };font-family:${FONT_STACK};">${escapeHtml(options.heading)}</h2>
              ${bodyParagraphs}

              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0 8px;">
                <tr>
                  <td style="background:${BRAND.amber};border-radius:8px;">
                    <a href="${safeUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 30px;font-size:16px;font-weight:700;color:${
                      BRAND.ink
                    };text-decoration:none;font-family:${FONT_STACK};">${escapeHtml(
                      options.buttonLabel,
                    )} &rarr;</a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 6px;font-size:13px;color:${
                BRAND.muted
              };font-family:${FONT_STACK};">Button not working? Paste this link into your browser:</p>
              <p style="margin:0;font-size:13px;line-height:1.5;word-break:break-all;font-family:${FONT_STACK};">
                <a href="${safeUrl}" target="_blank" rel="noopener" style="color:#8A6D0B;text-decoration:underline;">${safeUrl}</a>
              </p>

              <p style="margin:22px 0 8px;font-size:13px;color:${
                BRAND.muted
              };font-family:${FONT_STACK};">This link expires in 45 minutes.</p>
              <p style="margin:0;font-size:13px;color:${
                BRAND.muted
              };font-family:${FONT_STACK};">If you didn&#39;t request this, you can safely ignore this email.</p>
            </td>
          </tr>

          <!-- footer divider -->
          <tr>
            <td style="background:${BRAND.card};padding:0 40px;">
              <hr style="border:none;border-top:1px solid ${BRAND.border};margin:24px 0 0;" />
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td style="background:${BRAND.card};border-radius:0 0 16px 16px;padding:24px 40px 32px;">
              <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${
                BRAND.ink
              };font-family:${FONT_STACK};"><strong style="font-weight:800;">Cardstock</strong> &mdash; design LinkedIn cards &amp; carousels</p>
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 18px;">
                <tr>
                  <td style="padding-right:10px;">${pillPrimary(homeUrl, "Open Cardstock")}</td>
                  <td>${pillOutline(aboutUrl, "About")}</td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;line-height:1.5;color:${
                BRAND.muted
              };font-family:${FONT_STACK};">Automated message from a send-only address &mdash; please don&#39;t reply.<br />&copy; ${year} Cardstock</p>
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
