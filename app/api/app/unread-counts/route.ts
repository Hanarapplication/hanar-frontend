import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { removeNotificationsForInactivePosts } from '@/lib/postNotificationCleanup';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/**
 * Authenticated counts for the Flutter WebView shell (same logic as Navbar bell vs message badges).
 * Do not use from untrusted origins without normal session cookies.
 */
export async function GET(req: Request) {
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

    const userId = authedUser.id;

    const [{ data: businesses }, dmCountRes, { data: notifRows, error: notifErr }] = await Promise.all([
      supabaseAdmin.from('businesses').select('id').eq('owner_id', userId),
      supabaseAdmin
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', userId)
        .is('read_at', null),
      supabaseAdmin
        .from('notifications')
        .select('id, type, data')
        .eq('user_id', userId)
        .is('read_at', null),
    ]);

    const ownedIds = new Set((businesses || []).map((row: { id: string }) => String(row.id)));

    const directMessagesUnread = dmCountRes.count ?? 0;

    let bellNotificationsUnread = 0;
    if (!notifErr && notifRows) {
      const businessFiltered = (notifRows as Array<{ id: string; type?: string | null; data?: { business_id?: string }; url?: string | null }>).filter(
        (row) => {
          if (row.type === 'direct_message') return false;
          const businessId = row.data?.business_id;
          if (businessId && ownedIds.has(String(businessId))) return false;
          return true;
        },
      );
      const { visible } = await removeNotificationsForInactivePosts(supabaseAdmin, businessFiltered);
      bellNotificationsUnread = visible.length;
    }

    return NextResponse.json({
      directMessagesUnread,
      bellNotificationsUnread,
    });
  } catch (e) {
    console.error('[unread-counts]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
