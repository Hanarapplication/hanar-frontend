import { Resend } from 'resend';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Resend tag shape (analytics / filtering in Resend dashboard). */
export type HanarEmailTag = { name: string; value: string };

export type SendHanarEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  /** Optional plain-text alternative for clients that prefer it. */
  text?: string;
  tags?: HanarEmailTag[];
  /** Optional Supabase Auth user id (UUID) stored on email_logs.user_id. */
  logUserId?: string | null;
};

export type SendHanarEmailResult =
  | { success: true; data: { id: string } | null; error: null }
  | { success: false; data: null; error: string };

const DEFAULT_FROM = 'Hanar <noreply@hanar.net>';

const MAX_SUBJECT_LOG = 500;
const MAX_ERR_LOG = 2000;
const MAX_RECIPIENT_LOG = 320;
const MAX_TEMPLATE_LOG = 200;
const MAX_TAG_META_KEYS = 20;
const MAX_TAG_NAME_LEN = 80;
const MAX_TAG_VALUE_LEN = 200;

function getFromAddress(): string {
  const raw = process.env.EMAIL_FROM?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_FROM;
}

function normalizeRecipients(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to];
  return list.map((e) => e.trim()).filter(Boolean);
}

function getLogSupabase(): SupabaseClient | null {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;
  try {
    return createClient(url, key, { auth: { persistSession: false } });
  } catch {
    return null;
  }
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function templateFromTags(tags: HanarEmailTag[] | undefined): string | null {
  const v = tags?.find((t) => t.name === 'template')?.value?.trim();
  if (!v) return null;
  return v.slice(0, MAX_TEMPLATE_LOG);
}

function userIdForLog(
  explicit: string | null | undefined,
  tags: HanarEmailTag[] | undefined
): string | null {
  const ex = (explicit ?? '').trim();
  if (ex && isUuid(ex)) return ex;
  const fromTag = tags?.find((t) => t.name === 'user_id')?.value?.trim();
  if (fromTag && isUuid(fromTag)) return fromTag;
  return null;
}

function safeMetadataFromTags(
  tags: HanarEmailTag[] | undefined,
  recipientCount: number
): Record<string, unknown> {
  const tagMap: Record<string, string> = {};
  if (tags?.length) {
    let n = 0;
    for (const t of tags) {
      if (n >= MAX_TAG_META_KEYS) break;
      const name = (t.name || '').trim().slice(0, MAX_TAG_NAME_LEN);
      if (!name) continue;
      const lower = name.toLowerCase();
      if (
        lower.includes('secret') ||
        lower.includes('token') ||
        lower.includes('password') ||
        lower.includes('api_key') ||
        lower.includes('apikey')
      ) {
        continue;
      }
      tagMap[name] = String(t.value ?? '').slice(0, MAX_TAG_VALUE_LEN);
      n += 1;
    }
  }
  return { tags: tagMap, recipient_count: recipientCount };
}

async function emailLogInsertRow(
  supabase: SupabaseClient,
  row: {
    user_id: string | null;
    recipient_email: string | null;
    template: string | null;
    subject: string | null;
    status: 'pending' | 'sent' | 'failed';
    provider_message_id?: string | null;
    error_message?: string | null;
    metadata: Record<string, unknown>;
    sent_at?: string | null;
  }
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('email_logs')
      .insert({
        user_id: row.user_id,
        recipient_email: row.recipient_email,
        template: row.template,
        subject: row.subject,
        status: row.status,
        provider: 'resend',
        provider_message_id: row.provider_message_id ?? null,
        error_message: row.error_message ? row.error_message.slice(0, MAX_ERR_LOG) : null,
        metadata: row.metadata,
        sent_at: row.sent_at ?? null,
      })
      .select('id')
      .single();
    if (error || !data?.id) return null;
    return String(data.id);
  } catch {
    return null;
  }
}

async function emailLogUpdateRow(
  supabase: SupabaseClient,
  id: string,
  patch: {
    status: 'sent' | 'failed';
    provider_message_id?: string | null;
    error_message?: string | null;
    sent_at?: string | null;
  }
): Promise<void> {
  try {
    await supabase
      .from('email_logs')
      .update({
        status: patch.status,
        provider_message_id: patch.provider_message_id ?? null,
        error_message: patch.error_message ? patch.error_message.slice(0, MAX_ERR_LOG) : null,
        sent_at: patch.sent_at ?? null,
      })
      .eq('id', id);
  } catch {
    /* non-blocking */
  }
}

/**
 * Single entry point for outbound Hanar email (Resend).
 * Inserts email_logs (pending → sent/failed) when Supabase is configured; logging failures never block sends.
 * Does not persist HTML/text bodies or secrets. Console logs avoid PII (see recipientCount / subjectLength only).
 */
export async function sendHanarEmail(params: SendHanarEmailParams): Promise<SendHanarEmailResult> {
  const recipients = normalizeRecipients(params.to);
  const subjectLog = (params.subject || '').trim().slice(0, MAX_SUBJECT_LOG);
  const templateLog = templateFromTags(params.tags);
  const userIdLog = userIdForLog(params.logUserId, params.tags);
  const recipientCount = recipients.length;
  const metaBase = safeMetadataFromTags(params.tags, recipientCount);

  const supabase = getLogSupabase();

  const logFailedPreSend = async (errorMessage: string, firstRecipient: string | null) => {
    if (!supabase) return;
    await emailLogInsertRow(supabase, {
      user_id: userIdLog,
      recipient_email: firstRecipient ? firstRecipient.slice(0, MAX_RECIPIENT_LOG) : null,
      template: templateLog,
      subject: subjectLog || null,
      status: 'failed',
      error_message: errorMessage,
      metadata: metaBase,
    });
  };

  if (recipientCount === 0) {
    console.warn('[hanar-email] send skipped: no valid recipients');
    void logFailedPreSend('No valid recipient addresses', null);
    return { success: false, data: null, error: 'No valid recipient addresses' };
  }

  const firstRecipient = recipients[0]!.slice(0, MAX_RECIPIENT_LOG);

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error('[hanar-email] send blocked: RESEND_API_KEY is not set');
    void logFailedPreSend('Email is not configured (missing RESEND_API_KEY)', firstRecipient);
    return { success: false, data: null, error: 'Email is not configured (missing RESEND_API_KEY)' };
  }

  let logId: string | null = null;
  if (supabase) {
    logId = await emailLogInsertRow(supabase, {
      user_id: userIdLog,
      recipient_email: firstRecipient,
      template: templateLog,
      subject: subjectLog || null,
      status: 'pending',
      metadata: metaBase,
    });
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
      if (supabase && logId) {
        void emailLogUpdateRow(supabase, logId, {
          status: 'failed',
          error_message: msg,
        });
      } else if (supabase && !logId) {
        void emailLogInsertRow(supabase, {
          user_id: userIdLog,
          recipient_email: firstRecipient,
          template: templateLog,
          subject: subjectLog || null,
          status: 'failed',
          error_message: msg,
          metadata: metaBase,
        });
      }
      return { success: false, data: null, error: msg };
    }

    const messageId = data?.id ?? null;
    console.info('[hanar-email] sent', {
      messageId,
      recipientCount,
      subjectLength: params.subject.length,
    });

    if (supabase && logId) {
      void emailLogUpdateRow(supabase, logId, {
        status: 'sent',
        provider_message_id: messageId,
        sent_at: new Date().toISOString(),
      });
    } else if (supabase && !logId) {
      void emailLogInsertRow(supabase, {
        user_id: userIdLog,
        recipient_email: firstRecipient,
        template: templateLog,
        subject: subjectLog || null,
        status: 'sent',
        provider_message_id: messageId,
        metadata: metaBase,
        sent_at: new Date().toISOString(),
      });
    }

    return { success: true, data: messageId ? { id: messageId } : null, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error while sending email';
    console.error('[hanar-email] unexpected failure', { errorType: err instanceof Error ? err.name : typeof err });
    if (supabase && logId) {
      void emailLogUpdateRow(supabase, logId, {
        status: 'failed',
        error_message: message,
      });
    } else if (supabase && !logId) {
      void emailLogInsertRow(supabase, {
        user_id: userIdLog,
        recipient_email: firstRecipient,
        template: templateLog,
        subject: subjectLog || null,
        status: 'failed',
        error_message: message,
        metadata: metaBase,
      });
    }
    return { success: false, data: null, error: message };
  }
}
