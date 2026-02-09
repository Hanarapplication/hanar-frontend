import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type Payload = {
  orgUserId: string;
  title: string;
  body: string;
  url?: string | null;
};

export async function POST(req: Request) {
  try {
    const supabaseServer = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();
    let authedUser = user;

    if (!authedUser || authError) {
      const authHeader = req.headers.get('authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (token) {
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (error) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        authedUser = data.user || null;
      }
    }

    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = (await req.json()) as Payload;
    const orgUserId = (payload.orgUserId || '').trim();
    const title = (payload.title || '').trim();
    const body = (payload.body || '').trim();
    const url = (payload.url || '').trim() || null;

    if (!orgUserId || !title || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: orgUserId, title, body' },
        { status: 400 }
      );
    }
    if (title.length > 140 || body.length > 1000) {
      return NextResponse.json(
        { error: 'Title max 140 chars, body max 1000 chars' },
        { status: 400 }
      );
    }

    // Only the org owner can send
    if (orgUserId !== authedUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify org exists
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('user_id, full_name, username')
      .eq('user_id', orgUserId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get followers from follows: follower_id follows following_id (org user_id)
    const { data: followers, error: followersError } = await supabaseAdmin
      .from('follows')
      .select('follower_id')
      .eq('following_id', orgUserId);

    if (followersError) {
      return NextResponse.json(
        { error: followersError.message || 'Failed to fetch followers' },
        { status: 500 }
      );
    }

    const uniqueUserIds = Array.from(
      new Set((followers || []).map((row: { follower_id: string }) => row.follower_id))
    ).filter((id) => id && id !== orgUserId);

    const defaultUrl =
      org.username ? `/organization/${org.username}` : null;
    const rows = uniqueUserIds.map((userId) => ({
      user_id: userId,
      type: 'organization_update',
      title,
      body,
      url: url || defaultUrl,
      data: {
        org_user_id: orgUserId,
        org_name: org.full_name || org.username || 'Organization',
      },
    }));

    if (rows.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('notifications')
        .insert(rows);
      if (insertError) {
        return NextResponse.json(
          { error: insertError.message || 'Failed to send notifications' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { success: true, sent: rows.length },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
