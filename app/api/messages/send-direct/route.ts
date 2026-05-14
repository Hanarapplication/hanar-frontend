import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { runDmIncomingPushForMessage, type DmNotifyRow } from '@/lib/dmIncomingNotify';
import { graphemeLength, normalizeUserText, sanitizeUserText } from '@/lib/unicodeText';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/**
 * Server-side DM send + FCM (recipient can be offline / WebView killed).
 *
 * **Flutter / native shell:** Prefer this endpoint over inserting `direct_messages` directly
 * from the client. Direct Supabase inserts do not hit Next.js, so `/api/messages/notify-incoming`
 * never runs and the recipient gets no push when the app is closed.
 *
 * **Auth:** Cookie session (same site) or `Authorization: Bearer <supabase_access_token>`.
 *
 * **Register FCM after login:** `POST /api/push/register-token` with the same Bearer and body
 * `{ "token": "<fcm_registration_id>", "platform": "android" | "ios" }`. From WebView you can
 * also call `window.HanarApp.onToken(token, 'android'|'ios')` once the shell has the token.
 *
 * **FCM payload:** Built in `lib/firebaseAdmin.ts` — includes top-level `notification` (title/body),
 * `android.priority: high`, and `android.notification.channelId` = `hanar_high_importance_channel`
 * (maps to `android.notification.channel_id` on the wire).
 *
 * @example
 * ```http
 * POST /api/messages/send-direct
 * Content-Type: application/json
 * Authorization: Bearer <access_token>
 *
 * {
 *   "recipient_user_id": "<uuid>",
 *   "body": "Hello",
 *   "message_preview": "Hello",
 *   "attachment_url": null,
 *   "attachment_name": null,
 *   "attachment_mime": null,
 *   "attachment_size": null,
 *   "recipient_entity_type": null,
 *   "recipient_entity_id": null,
 *   "recipient_entity_label": null
 * }
 * ```
 */
type SendDirectBody = {
  recipient_user_id?: string;
  body?: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
  recipient_entity_type?: string | null;
  recipient_entity_id?: string | null;
  recipient_entity_label?: string | null;
  /** Shown in the push tray when set; otherwise derived from `body` / attachment. */
  message_preview?: string | null;
};

export async function POST(req: Request) {
  try {
    const supabaseServer = createRouteHandlerClient({ cookies });
    let {
      data: { user: authedUser },
    } = await supabaseServer.auth.getUser();

    if (!authedUser) {
      const authHeader = req.headers.get('authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (token) {
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (!error) authedUser = data.user;
      }
    }

    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as SendDirectBody;
    const recipient = (body.recipient_user_id || '').trim();
    if (!recipient) {
      return NextResponse.json({ error: 'Missing recipient_user_id' }, { status: 400 });
    }
    if (recipient === authedUser.id) {
      return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 });
    }

    const rawBody = typeof body.body === 'string' ? body.body : '';
    const safeBody = sanitizeUserText(rawBody);
    const normalized = normalizeUserText(rawBody);
    const attachmentUrl =
      body.attachment_url != null && String(body.attachment_url).trim()
        ? String(body.attachment_url).trim()
        : null;
    const hasAttachment = Boolean(attachmentUrl);

    if (!hasAttachment && !normalized) {
      return NextResponse.json(
        { error: 'Message body cannot be empty unless attachment_url is set' },
        { status: 400 },
      );
    }

    if (graphemeLength(safeBody) > 2000) {
      return NextResponse.json({ error: 'Message body exceeds maximum length' }, { status: 400 });
    }

    const et = body.recipient_entity_type;
    const entityType =
      et === 'user' || et === 'business' || et === 'organization' || et == null || et === ''
        ? et || null
        : null;
    if (et && !entityType) {
      return NextResponse.json({ error: 'Invalid recipient_entity_type' }, { status: 400 });
    }

    const { data: blockRow } = await supabaseAdmin
      .from('message_blocks')
      .select('id')
      .eq('blocker_id', recipient)
      .eq('blocked_id', authedUser.id)
      .maybeSingle();

    if (blockRow) {
      return NextResponse.json({ error: 'Recipient has blocked messages from you' }, { status: 403 });
    }

    const messagePreview =
      typeof body.message_preview === 'string' ? body.message_preview.trim() : '';

    const bodyForDb = hasAttachment && !normalized ? '' : normalized;

    const insertPayload = {
      sender_user_id: authedUser.id,
      recipient_user_id: recipient,
      body: bodyForDb,
      attachment_url: attachmentUrl,
      attachment_name:
        body.attachment_name != null && String(body.attachment_name).trim()
          ? String(body.attachment_name).trim()
          : null,
      attachment_mime:
        body.attachment_mime != null && String(body.attachment_mime).trim()
          ? String(body.attachment_mime).trim()
          : null,
      attachment_size:
        typeof body.attachment_size === 'number' && Number.isFinite(body.attachment_size)
          ? Math.trunc(body.attachment_size)
          : null,
      recipient_entity_type: entityType,
      recipient_entity_id:
        body.recipient_entity_id != null && String(body.recipient_entity_id).trim()
          ? String(body.recipient_entity_id).trim()
          : null,
      recipient_entity_label:
        body.recipient_entity_label != null && String(body.recipient_entity_label).trim()
          ? String(body.recipient_entity_label).trim()
          : null,
    };

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('direct_messages')
      .insert(insertPayload)
      .select('id, sender_user_id, recipient_user_id, body, attachment_url, dm_push_sent_at')
      .single();

    if (insertError || !inserted) {
      console.error('[send-direct] insert failed', insertError);
      return NextResponse.json(
        { error: insertError?.message || 'Failed to save message' },
        { status: 400 },
      );
    }

    const dmRow: DmNotifyRow = {
      id: inserted.id as string,
      sender_user_id: inserted.sender_user_id as string,
      recipient_user_id: inserted.recipient_user_id as string,
      body: (inserted.body as string | null) ?? null,
      attachment_url: (inserted.attachment_url as string | null) ?? null,
      dm_push_sent_at: (inserted.dm_push_sent_at as string | null) ?? null,
    };

    const pushResult = await runDmIncomingPushForMessage(supabaseAdmin, {
      row: dmRow,
      authedSenderId: authedUser.id,
      messagePreview,
    });

    if (!pushResult.ok) {
      return NextResponse.json(
        { error: pushResult.error, messageId: dmRow.id, inserted: true },
        { status: pushResult.status },
      );
    }

    return NextResponse.json({
      success: true,
      messageId: dmRow.id,
      notificationInserted: pushResult.notificationInserted,
      push: pushResult.push,
      log: pushResult.log,
      skipped: pushResult.skipped,
      ...(pushResult.skipped ? { reason: pushResult.reason } : {}),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error';
    console.error('[send-direct] unexpected', e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
