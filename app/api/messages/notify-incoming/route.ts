import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { runDmIncomingPushForMessage, type DmNotifyRow } from '@/lib/dmIncomingNotify';

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

    const dmRow: DmNotifyRow = {
      id: row.id as string,
      sender_user_id: row.sender_user_id as string,
      recipient_user_id: row.recipient_user_id as string,
      body: (row.body as string | null) ?? null,
      attachment_url: (row.attachment_url as string | null) ?? null,
      dm_push_sent_at: (row.dm_push_sent_at as string | null) ?? null,
    };

    const result = await runDmIncomingPushForMessage(supabaseAdmin, {
      row: dmRow,
      authedSenderId: authedUser.id,
      messagePreview: messagePreviewBody,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (result.skipped) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: result.reason,
        push: result.push,
        log: result.log,
      });
    }

    return NextResponse.json({
      success: true,
      notificationInserted: result.notificationInserted,
      push: result.push,
      log: result.log,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error';
    console.error('[notify-incoming] unexpected', e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
