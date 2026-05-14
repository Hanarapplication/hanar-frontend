import type { SupabaseClient } from '@supabase/supabase-js';
import { buildDirectMessagePushContent, truncateForPushBody } from '@/lib/firebaseAdmin';
import { sendDmNativePushToRecipient } from '@/lib/pushForUsers';
import { graphemeLength, truncateGraphemes } from '@/lib/unicodeText';

/** @username for title; prefers profiles.username, then registeredaccounts.username */
export async function resolveSenderAtHandle(
  supabaseAdmin: SupabaseClient,
  senderUserId: string,
): Promise<string> {
  const [profileRes, accountRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('username').eq('id', senderUserId).maybeSingle(),
    supabaseAdmin.from('registeredaccounts').select('username').eq('user_id', senderUserId).maybeSingle(),
  ]);
  const fromProfile = (profileRes.data as { username?: string | null } | null)?.username?.trim();
  if (fromProfile) {
    const h = fromProfile.replace(/^@+/, '');
    return h ? `@${h}` : '@user';
  }
  const fromAccount = (accountRes.data as { username?: string | null } | null)?.username?.trim();
  if (fromAccount) {
    const h = fromAccount.replace(/^@+/, '');
    return h ? `@${h}` : '@user';
  }
  return '@user';
}

/** Columns required to build preview + FCM + idempotency for `direct_messages`. */
export type DmNotifyRow = {
  id: string;
  sender_user_id: string;
  recipient_user_id: string;
  body: string | null;
  attachment_url: string | null;
  dm_push_sent_at: string | null;
};

export type DmIncomingPushRun =
  | {
      ok: true;
      skipped: true;
      reason: 'dm_push_already_sent';
      messageId: string;
      senderUserId: string;
      recipientUserId: string;
      notificationInserted: boolean;
      push: { successCount: number; failureCount: number };
      log: Record<string, unknown>;
    }
  | {
      ok: true;
      skipped: false;
      messageId: string;
      senderUserId: string;
      recipientUserId: string;
      notificationInserted: boolean;
      push: { successCount: number; failureCount: number };
      log: Record<string, unknown>;
    }
  | { ok: false; status: number; error: string };

/**
 * After a row exists in `direct_messages`, insert in-app notification (best effort) and
 * send FCM to the recipient (see {@link sendDmNativePushToRecipient}). Idempotent via
 * `dm_push_sent_at` when FCM succeeds.
 */
export async function runDmIncomingPushForMessage(
  supabaseAdmin: SupabaseClient,
  args: {
    row: DmNotifyRow;
    authedSenderId: string;
    /** Optional tray preview; otherwise derived from DB body / attachment. */
    messagePreview?: string;
  },
): Promise<DmIncomingPushRun> {
  const authedSenderId = (args.authedSenderId || '').trim();
  const messagePreviewBody =
    typeof args.messagePreview === 'string' ? args.messagePreview.trim() : '';
  const r = args.row;

  if (!r?.id || !authedSenderId) {
    return { ok: false, status: 400, error: 'Missing row or sender' };
  }

  if (r.sender_user_id !== authedSenderId) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  const recipientUserId = r.recipient_user_id;
  const senderUserId = r.sender_user_id;

  if (r.dm_push_sent_at) {
    const skipLog = {
      messageId: r.id,
      senderUserId,
      recipientUserId,
      tokenCount: 0,
      latestTokenUpdatedAt: null as string | null,
      firebaseSuccessCount: 0,
      firebaseFailureCount: 0,
      firebaseErrors: [] as { code?: string; message: string }[],
      skipped: true,
      reason: 'dm_push_already_sent',
    };
    console.log('[dmIncomingNotify] DM push attempt', skipLog);
    return {
      ok: true,
      skipped: true,
      reason: 'dm_push_already_sent',
      messageId: r.id,
      senderUserId,
      recipientUserId,
      notificationInserted: true,
      push: { successCount: 0, failureCount: 0 },
      log: skipLog,
    };
  }

  const rawBody = typeof r.body === 'string' ? r.body.trim() : '';
  const hasAttachment = Boolean(r.attachment_url);
  const previewFromDb =
    hasAttachment && !rawBody
      ? 'Sent an attachment'
      : rawBody
        ? graphemeLength(rawBody) > 120
          ? `${truncateGraphemes(rawBody, 120)}…`
          : rawBody
        : '';

  const previewForPush = truncateForPushBody(
    messagePreviewBody || previewFromDb || 'New message',
    80,
  );

  const atHandle = await resolveSenderAtHandle(supabaseAdmin, senderUserId);
  const title = `${atHandle} sent you a message`;
  const link = `/messages?conversation_id=${encodeURIComponent(senderUserId)}`;

  const { error: notifErr } = await supabaseAdmin.from('notifications').insert({
    user_id: recipientUserId,
    type: 'direct_message',
    title,
    body: previewForPush || 'New message',
    url: link,
    read_at: null,
    created_at: new Date().toISOString(),
    data: {
      recipient_user_id: recipientUserId,
      sender_user_id: senderUserId,
      message_id: r.id,
    },
  });

  let notificationInserted = true;
  if (notifErr) {
    notificationInserted = false;
    console.error('[dmIncomingNotify] notification insert failed (still sending DM FCM)', {
      message: notifErr.message,
      code: notifErr.code,
      recipient_user_id: recipientUserId,
      message_id: r.id,
    });
  }

  const pushBuilt = buildDirectMessagePushContent({
    senderHandle: atHandle,
    messagePreview: previewForPush || 'New message',
    senderUserId,
    messageId: r.id,
  });

  let tokenCount = 0;
  let latestTokenUpdatedAt: string | null = null;
  let firebaseSuccessCount = 0;
  let firebaseFailureCount = 0;
  let firebaseErrors: { code?: string; message: string }[] = [];

  try {
    const dmSend = await sendDmNativePushToRecipient(recipientUserId, pushBuilt);
    tokenCount = dmSend.tokenCount;
    latestTokenUpdatedAt = dmSend.latestTokenUpdatedAt;
    firebaseSuccessCount = dmSend.result.successCount;
    firebaseFailureCount = dmSend.result.failureCount;
    firebaseErrors = dmSend.result.errors;

    if (firebaseSuccessCount > 0) {
      const now = new Date().toISOString();
      const { data: updated, error: markErr } = await supabaseAdmin
        .from('direct_messages')
        .update({ dm_push_sent_at: now })
        .eq('id', r.id)
        .is('dm_push_sent_at', null)
        .select('id')
        .maybeSingle();

      if (markErr) {
        console.error('[dmIncomingNotify] failed to mark dm_push_sent_at', {
          message: markErr.message,
          messageId: r.id,
        });
      } else if (!updated) {
        console.warn('[dmIncomingNotify] dm_push_sent_at race — another worker may have marked', {
          messageId: r.id,
        });
      }
    }
  } catch (pushErr) {
    const msg = pushErr instanceof Error ? pushErr.message : String(pushErr);
    firebaseErrors = [{ message: msg }];
    console.error('[dmIncomingNotify] push failure', pushErr);
  }

  const attemptLog = {
    messageId: r.id,
    senderUserId,
    recipientUserId,
    tokenCount,
    latestTokenUpdatedAt,
    firebaseSuccessCount,
    firebaseFailureCount,
    firebaseErrors,
  };
  console.log('[dmIncomingNotify] DM push attempt', attemptLog);

  return {
    ok: true,
    skipped: false,
    messageId: r.id,
    senderUserId,
    recipientUserId,
    notificationInserted,
    push: { successCount: firebaseSuccessCount, failureCount: firebaseFailureCount },
    log: attemptLog,
  };
}
