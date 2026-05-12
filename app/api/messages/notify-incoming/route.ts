import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { buildDirectMessagePushContent } from '@/lib/firebaseAdmin';
import { sendPushToUserIds } from '@/lib/pushForUsers';
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
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('username')
    .eq('id', senderUserId)
    .maybeSingle();
  const fromProfile = (profile as { username?: string | null } | null)?.username?.trim();
  if (fromProfile) {
    const h = fromProfile.replace(/^@+/, '');
    return h ? `@${h}` : '@user';
  }
  const { data: account } = await supabaseAdmin
    .from('registeredaccounts')
    .select('username')
    .eq('user_id', senderUserId)
    .maybeSingle();
  const fromAccount = (account as { username?: string | null } | null)?.username?.trim();
  if (fromAccount) {
    const h = fromAccount.replace(/^@+/, '');
    return h ? `@${h}` : '@user';
  }
  return '@user';
}

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

    const body = (await req.json()) as { messageId?: string };
    const messageId = (body.messageId || '').trim();
    if (!messageId) {
      return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });
    }

    const { data: row, error: rowError } = await supabaseAdmin
      .from('direct_messages')
      .select('id, sender_user_id, recipient_user_id, body, attachment_url')
      .eq('id', messageId)
      .maybeSingle();

    if (rowError || !row) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    if (row.sender_user_id !== authedUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const recipientUserId = row.recipient_user_id as string;
    const senderUserId = row.sender_user_id as string;
    if (!recipientUserId || !senderUserId || recipientUserId === senderUserId) {
      return NextResponse.json({ error: 'Invalid message participants' }, { status: 400 });
    }

    console.log('[notify-incoming] loaded message', {
      messageId: row.id,
      sender_user_id: senderUserId,
      recipient_user_id: recipientUserId,
    });
    console.log('[notify-incoming] recipient id', recipientUserId);

    const rawBody = typeof row.body === 'string' ? row.body.trim() : '';
    const hasAttachment = Boolean(row.attachment_url);
    const previewBody =
      hasAttachment && !rawBody
        ? 'Sent an attachment'
        : rawBody
          ? graphemeLength(rawBody) > 120
            ? `${truncateGraphemes(rawBody, 120)}…`
            : rawBody
        : '';

    const atHandle = await resolveSenderAtHandle(senderUserId);
    const title = `${atHandle} sent you a message`;
    const link = `/messages?conversation_id=${encodeURIComponent(senderUserId)}`;

    const { error: notifErr } = await supabaseAdmin.from('notifications').insert({
      user_id: recipientUserId,
      type: 'direct_message',
      title,
      body: previewBody,
      url: link,
      read_at: null,
      created_at: new Date().toISOString(),
      data: {
        recipient_user_id: recipientUserId,
        sender_user_id: senderUserId,
        message_id: row.id,
      },
    });

    if (notifErr) {
      console.error('[notify-incoming] notification insert failed', notifErr);
      return NextResponse.json(
        { success: false, error: 'Failed to insert notification', details: notifErr.message },
        { status: 500 },
      );
    }

    console.log('[notify-incoming] notification inserted', {
      recipient_user_id: recipientUserId,
      sender_user_id: senderUserId,
      message_id: row.id,
    });

    const push = buildDirectMessagePushContent({
      senderHandle: atHandle,
      messagePreview: previewBody || 'New message',
      senderUserId,
    });

    try {
      const pushResult = await sendPushToUserIds([recipientUserId], push);
      console.log('[notify-incoming] push sent', pushResult);
    } catch (pushErr) {
      console.error('[notify-incoming] push failure', pushErr);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error';
    console.error('[notify-incoming] unexpected', e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
