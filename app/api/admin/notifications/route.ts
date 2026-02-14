import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL');
if (!SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const allowedRoles = ['owner', 'ceo', 'topmanager', 'manager', 'reviewer', 'business'];

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const role = cookieStore.get('adminRole')?.value;
    if (!role || !allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const businessId = (searchParams.get('businessId') || '').trim();
    const orgUserId = (searchParams.get('orgUserId') || '').trim();

    if (orgUserId) {
      const { data: orgNotifs, error: orgErr } = await supabaseAdmin
        .from('notifications')
        .select('id, type, title, body, url, created_at, data')
        .eq('type', 'organization_update')
        .filter('data->>org_user_id', 'eq', orgUserId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 });

      const grouped: Record<string, any> = {};
      for (const row of orgNotifs || []) {
        const createdAt = new Date(row.created_at);
        const bucket = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate(), createdAt.getHours(), createdAt.getMinutes()).toISOString();
        const key = `${row.title}||${row.body}||${row.url || ''}||${bucket}`;
        if (!grouped[key]) {
          grouped[key] = {
            id: row.id,
            kind: 'organization_update',
            title: row.title,
            body: row.body,
            created_at: row.created_at,
            status: 'sent',
            data: { ...(row.data || {}), sent_count: 1 },
          };
        } else {
          grouped[key].data.sent_count = (grouped[key].data.sent_count || 1) + 1;
          if (new Date(row.created_at).getTime() > new Date(grouped[key].created_at).getTime()) {
            grouped[key].created_at = row.created_at;
          }
        }
      }
      const items = Object.values(grouped).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return NextResponse.json({ notifications: items });
    }

    if (!businessId) {
      return NextResponse.json({ error: 'Missing businessId or orgUserId' }, { status: 400 });
    }

    const [outboxRes, followerRes] = await Promise.all([
      supabaseAdmin
        .from('area_blast_outbox')
        .select('id, business_id, title, body, created_at, status, data, radius_miles')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('notifications')
        .select('id, type, title, body, url, created_at, data')
        .eq('type', 'business_update')
        .contains('data', { business_id: businessId })
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    if (outboxRes.error) {
      return NextResponse.json({ error: outboxRes.error.message }, { status: 500 });
    }
    if (followerRes.error) {
      return NextResponse.json({ error: followerRes.error.message }, { status: 500 });
    }

    const outboxItems = (outboxRes.data || []).map((row: any) => ({
      id: row.id,
      business_id: row.business_id,
      kind: 'area_blast',
      title: row.title,
      body: row.body,
      created_at: row.created_at,
      status: row.status,
      data: row.data || {},
      radius_miles: row.radius_miles ?? row.data?.radius_miles ?? null,
    }));

    const groupedFollower: Record<string, any> = {};
    for (const row of followerRes.data || []) {
      const createdAt = new Date(row.created_at);
      const bucket = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate(), createdAt.getHours(), createdAt.getMinutes()).toISOString();
      const key = `${row.title}||${row.body}||${row.url || ''}||${bucket}`;
      if (!groupedFollower[key]) {
        groupedFollower[key] = {
          id: row.id,
          business_id: businessId,
          kind: 'follower_update',
          title: row.title,
          body: row.body,
          created_at: row.created_at,
          status: 'sent',
          data: {
            ...(row.data || {}),
            sent_count: 1,
          },
        };
      } else {
        groupedFollower[key].data.sent_count = (groupedFollower[key].data.sent_count || 1) + 1;
        if (new Date(row.created_at).getTime() > new Date(groupedFollower[key].created_at).getTime()) {
          groupedFollower[key].created_at = row.created_at;
        }
      }
    }

    const followerItems = Object.values(groupedFollower);

    const merged = [...outboxItems, ...followerItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({ notifications: merged }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const role = cookieStore.get('adminRole')?.value;
    if (!role || !allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const id = String(body.id || '');
    const action = String(body.action || '');
    if (!id || !['update', 'delete', 'flag'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    if (action === 'delete') {
      const source = body.source === 'notification' ? 'notification' : 'area_blast';
      if (source === 'notification') {
        const { error } = await supabaseAdmin.from('notifications').delete().eq('id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        const { error } = await supabaseAdmin.from('area_blast_outbox').delete().eq('id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (action === 'update') {
      const nextTitle = String(body.title || '').trim();
      const nextBody = String(body.body || '').trim();
      if (!nextTitle || !nextBody) {
        return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
      }
      const { error } = await supabaseAdmin
        .from('area_blast_outbox')
        .update({ title: nextTitle, body: nextBody })
        .eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const flagged = Boolean(body.flagged);
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('area_blast_outbox')
      .select('data')
      .eq('id', id)
      .maybeSingle();
    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    const nextData = {
      ...(existing?.data || {}),
      flagged,
      flagged_at: flagged ? new Date().toISOString() : null,
    };
    const { error } = await supabaseAdmin
      .from('area_blast_outbox')
      .update({ data: nextData })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}
