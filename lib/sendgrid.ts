const apiKey = process.env.SENDGRID_API_KEY;
const fromEmail = process.env.SENDGRID_FROM_EMAIL;
const fromName = process.env.SENDGRID_FROM_NAME;

const sendgridConfigured =
  apiKey && apiKey.length > 0 && fromEmail && fromEmail.length > 0;

function looksLikeEmail(value: string): boolean {
  // Pragmatic validation for demo/server-side guardrails.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Sends an email via SendGrid.
 * Falls back to console.log if SendGrid env vars are not configured.
 */
export async function sendEmail({
  to,
  subject,
  text,
  html,
}: SendEmailParams): Promise<void> {
  if (!looksLikeEmail(to)) {
    throw new Error("Invalid recipient email address");
  }
  if (fromEmail && !looksLikeEmail(fromEmail)) {
    throw new Error("Invalid SENDGRID_FROM_EMAIL address");
  }

  if (!sendgridConfigured) {
    console.log(
      `[sendgrid] Email not configured — would send to ${to}\nSubject: ${subject}\n\n${text}`
    );
    return;
  }

  const sgMail = (await import("@sendgrid/mail")).default;
  sgMail.setApiKey(apiKey!);

  await sgMail.send({
    to,
    from: fromName ? { email: fromEmail!, name: fromName } : fromEmail!,
    subject,
    text,
    ...(html ? { html } : {}),
  });
}

