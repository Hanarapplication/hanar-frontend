import { Resend } from 'resend';

/** Resend tag shape (analytics / filtering in Resend dashboard). */
export type HanarEmailTag = { name: string; value: string };

export type SendHanarEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  /** Optional plain-text alternative for clients that prefer it. */
  text?: string;
  tags?: HanarEmailTag[];
};

export type SendHanarEmailResult =
  | { success: true; data: { id: string } | null; error: null }
  | { success: false; data: null; error: string };

const DEFAULT_FROM = 'Hanar <noreply@hanar.net>';

function getFromAddress(): string {
  const raw = process.env.EMAIL_FROM?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_FROM;
}

function normalizeRecipients(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to];
  return list.map((e) => e.trim()).filter(Boolean);
}

/**
 * Single entry point for outbound Hanar email (Resend).
 * Does not log recipient addresses or full bodies — only safe metadata.
 */
export async function sendHanarEmail(params: SendHanarEmailParams): Promise<SendHanarEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error('[hanar-email] send blocked: RESEND_API_KEY is not set');
    return { success: false, data: null, error: 'Email is not configured (missing RESEND_API_KEY)' };
  }

  const recipients = normalizeRecipients(params.to);
  if (recipients.length === 0) {
    console.warn('[hanar-email] send skipped: no valid recipients');
    return { success: false, data: null, error: 'No valid recipient addresses' };
  }

  const from = getFromAddress();
  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: recipients,
      subject: params.subject,
      html: params.html,
      ...(params.text ? { text: params.text } : {}),
      ...(params.tags && params.tags.length > 0 ? { tags: params.tags } : {}),
    });

    if (error) {
      const msg = typeof error.message === 'string' ? error.message : 'Resend returned an error';
      console.error('[hanar-email] Resend API error', { code: (error as { name?: string }).name ?? 'unknown' });
      return { success: false, data: null, error: msg };
    }

    const id = data?.id ?? null;
    console.info('[hanar-email] sent', {
      messageId: id,
      recipientCount: recipients.length,
      subjectLength: params.subject.length,
    });

    return { success: true, data: id ? { id } : null, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error while sending email';
    console.error('[hanar-email] unexpected failure', { errorType: err instanceof Error ? err.name : typeof err });
    return { success: false, data: null, error: message };
  }
}
