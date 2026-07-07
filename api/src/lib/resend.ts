// Resend email delivery (spec sections 5.3/5.4) -- verification + password
// reset share this one send helper; every call carries an Idempotency-Key
// header so a client retry never double-sends the same email.

const RESEND_API_URL = "https://api.resend.com/emails";

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
    subject: "Verify your ContentPro email address",
    html: [
      "<p>Welcome to ContentPro.</p>",
      `<p><a href="${link}">Click here to verify your email address</a>.</p>`,
      "<p>This link expires in 45 minutes. If you didn't create this account, you can ignore this email.</p>",
    ].join(""),
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
    subject: "Reset your ContentPro password",
    html: [
      "<p>We received a request to reset your ContentPro password.</p>",
      `<p><a href="${link}">Click here to choose a new password</a>.</p>`,
      "<p>This link expires in 45 minutes. If you didn't request this, you can ignore this email.</p>",
    ].join(""),
    idempotencyKey: idempotencyKeyFor("password-reset", email, token),
  });
}
