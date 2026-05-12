import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { buildDirectMessagePushContent, truncateForPushBody } from '@/lib/firebaseAdmin';
import { sendDmNativePushToRecipient } from '@/lib/pushForUsers';
import { graphemeLength, truncateGraphemes } from '@/lib/unicodeText';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/**
 * RLS (verify in Supabase):
 * - Recipients: SELECT on notifications where user_id = auth.uid() (or equivalent) so the bell loads.
 * - Server: this route uses the service role key, so INSERT bypasses RLS; app users never call INSERT directly.
 */

/** @username for title; prefers profiles.username, then registeredaccounts.username */
async function resolveSenderAtHandle(senderUserId: string): Promise<string> {
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

type NotifyBody = {
  messageId?: string;
  senderUserId?: string;
  recipientUserId?: string;
  conversationId?: string;
  messagePreview?: string;
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

    const body = (await req.json()) as NotifyBody;
    const messageId = (body.messageId || '').trim();
    const senderUserIdBody = (body.senderUserId || '').trim();
    const recipientUserIdBody = (body.recipientUserId || '').trim();
    const conversationIdBody = (body.conversationId || '').trim();
    const messagePreviewBody = typeof body.messagePreview === 'string' ? body.messagePreview.trim() : '';

    if (!messageId || !senderUserIdBody || !recipientUserIdBody || !conversationIdBody) {
      return NextResponse.json(
        { error: 'Missing messageId, senderUserId, recipientUserId, or conversationId' },
        { status: 400 },
      );
    }

    if (senderUserIdBody === recipientUserIdBody) {
      return NextResponse.json({ error: 'Invalid participants' }, { status: 400 });
    }

    if (senderUserIdBody !== authedUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (conversationIdBody !== senderUserIdBody) {
      return NextResponse.json({ error: 'conversationId must match senderUserId' }, { status: 400 });
    }

    const { data: row, error: rowError } = await supabaseAdmin
      .from('direct_messages')
      .select('id, sender_user_id, recipient_user_id, body, attachment_url, dm_push_sent_at')
      .eq('id', messageId)
      .maybeSingle();

    if (rowError || !row) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (row.sender_user_id !== authedUser.id || row.sender_user_id !== senderUserIdBody) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (row.recipient_user_id !== recipientUserIdBody) {
      return NextResponse.json({ error: 'Message does not match recipient' }, { status: 400 });
    }

    const recipientUserId = row.recipient_user_id as string;
    const senderUserId = row.sender_user_id as string;

    if (row.dm_push_sent_at) {
      const skipLog = {
        messageId: row.id,
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
      console.log('[notify-incoming] DM push attempt', skipLog);
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'dm_push_already_sent',
        push: { successCount: 0, failureCount: 0 },
        log: skipLog,
      });
    }

    const rawBody = typeof row.body === 'string' ? row.body.trim() : '';
    const hasAttachment = Boolean(row.attachment_url);
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

    const atHandle = await resolveSenderAtHandle(senderUserId);
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
        message_id: row.id,
      },
    });

    let notificationInserted = true;
    if (notifErr) {
      notificationInserted = false;
      console.error('[notify-incoming] notification insert failed (still sending DM FCM)', {
        message: notifErr.message,
        code: notifErr.code,
        recipient_user_id: recipientUserId,
        message_id: row.id,
      });
    }

    const pushBuilt = buildDirectMessagePushContent({
      senderHandle: atHandle,
      messagePreview: previewForPush || 'New message',
      senderUserId,
      messageId: row.id as string,
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
          .eq('id', messageId)
          .is('dm_push_sent_at', null)
          .select('id')
          .maybeSingle();

        if (markErr) {
          console.error('[notify-incoming] failed to mark dm_push_sent_at', {
            message: markErr.message,
            messageId,
          });
        } else if (!updated) {
          console.warn('[notify-incoming] dm_push_sent_at race — another worker may have marked', {
            messageId,
          });
        }
      }
    } catch (pushErr) {
      const msg = pushErr instanceof Error ? pushErr.message : String(pushErr);
      firebaseErrors = [{ message: msg }];
      console.error('[notify-incoming] push failure', pushErr);
    }

    const attemptLog = {
      messageId: row.id,
      senderUserId,
      recipientUserId,
      tokenCount,
      latestTokenUpdatedAt,
      firebaseSuccessCount,
      firebaseFailureCount,
      firebaseErrors,
    };
    console.log('[notify-incoming] DM push attempt', attemptLog);

    return NextResponse.json({
      success: true,
      notificationInserted,
      push: { successCount: firebaseSuccessCount, failureCount: firebaseFailureCount },
      log: attemptLog,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error';
    console.error('[notify-incoming] unexpected', e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
