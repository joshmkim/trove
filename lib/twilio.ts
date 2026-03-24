const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

const twilioConfigured =
  accountSid && accountSid.length > 0 &&
  authToken  && authToken.length  > 0 &&
  fromNumber && fromNumber.length > 0;

/** Formats a 10-digit US number to E.164 if not already formatted. */
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return phone;
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

/**
 * Sends an SMS to `to` with `body`.
 * Falls back to console.log if Twilio env vars are not configured.
 */
export async function sendSMS(to: string, body: string): Promise<void> {
  const formatted = toE164(to);

  if (!twilioConfigured) {
    console.log(`[twilio] SMS not configured — would send to ${formatted}:\n${body}`);
    return;
  }

  const twilio = (await import("twilio")).default;
  const client = twilio(accountSid!, authToken!);

  await client.messages.create({
    from: toE164(fromNumber!),
    to: formatted,
    body,
  });
}
