import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase env');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const allowedRoles = ['owner', 'ceo', 'topmanager', 'manager', 'reviewer', 'moderator', 'support', 'editor', 'readonly'];

async function getAdminUser(req: Request): Promise<{ id: string; email?: string } | null> {
  let user: { id: string; email?: string } | null = null;

  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user: cookieUser }, error } = await supabase.auth.getUser();
    if (!error && cookieUser) user = cookieUser;
  } catch {
    // cookie auth may fail in some environments
  }

  if (!user && req) {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (token) {
      if (ANON_KEY) {
        const anon = createClient(SUPABASE_URL!, ANON_KEY, {
          auth: { persistSession: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: { user: tokenUser } } = await anon.auth.getUser();
        if (tokenUser) user = tokenUser;
      }
      if (!user) {
        const { data } = await supabaseAdmin.auth.getUser(token);
        if (data?.user) user = data.user;
      }
    }
  }

  if (!user) return null;

  let data: { role?: string } | null = null;
  if (user.id) {
    const r = await supabaseAdmin.from('adminaccounts').select('role').eq('user_id', user.id).maybeSingle();
    data = r.data;
  }
  if (!data?.role && user.email) {
    const r = await supabaseAdmin.from('adminaccounts').select('role').eq('email', user.email.toLowerCase()).maybeSingle();
    data = r.data;
  }
  if (!data?.role || !allowedRoles.includes(data.role)) return null;
  return user;
}

export async function GET(req: Request) {
  try {
    const user = await getAdminUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [
      { count: businessesPending },
      { count: notificationPending },
      { count: reportedPosts },
    ] = await Promise.all([
      supabaseAdmin
        .from('businesses')
        .select('*', { count: 'exact', head: true })
        .eq('moderation_status', 'on_hold')
        .eq('is_archived', false),
      supabaseAdmin
        .from('area_blast_outbox')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabaseAdmin
        .from('community_posts')
        .select('*', { count: 'exact', head: true })
        .eq('is_reported', true)
        .or('is_deleted.eq.false,is_deleted.is.null'),
    ]);

    let reportedComments = 0;
    try {
      const { count } = await supabaseAdmin
        .from('community_comments')
        .select('*', { count: 'exact', head: true })
        .eq('is_reported', true);
      reportedComments = count ?? 0;
    } catch {
      // column may not exist
    }

    let contactUs = 0;
    try {
      const { count } = await supabaseAdmin
        .from('contact_submissions')
        .select('*', { count: 'exact', head: true })
        .or('status.is.null,status.eq.pending');
      contactUs = count ?? 0;
    } catch {
      // table may not exist
    }

    return NextResponse.json({
      businesses_pending_approval: businessesPending ?? 0,
      notification_requests_pending: notificationPending ?? 0,
      reported_posts: reportedPosts ?? 0,
      reported_comments: reportedComments,
      contact_us_to_review: contactUs,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
