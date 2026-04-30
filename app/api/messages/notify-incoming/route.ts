import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
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
 * After the client inserts a direct_messages row, call this so the recipient can get an FCM
 * notification on the lock screen (same tokens as bell notifications).
 */
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

    const rawBody = typeof row.body === 'string' ? row.body.trim() : '';
    const hasAttachment = Boolean(row.attachment_url);
    const preview =
      hasAttachment && !rawBody
        ? 'Sent an attachment'
        : rawBody
          ? graphemeLength(rawBody) > 120
            ? `${truncateGraphemes(rawBody, 120)}…`
            : rawBody
        : 'New message';

    const title = 'New message on Hanar';
    const url = '/messages';

    try {
      await sendPushToUserIds([row.recipient_user_id], title, preview, url);
    } catch (pushErr) {
      console.warn('[notify-incoming] FCM push:', pushErr);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
