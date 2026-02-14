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

const allowedRoles = ['owner', 'ceo', 'topmanager', 'manager', 'reviewer', 'moderator', 'business'];

async function getAdminUser(req: Request): Promise<{ id: string; email?: string } | null> {
  let user: { id: string; email?: string } | null = null;

  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user: cookieUser }, error } = await supabase.auth.getUser();
    if (!error && cookieUser) user = cookieUser;
  } catch {
    // cookie auth may fail
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

// GET: list all reports with optional filters
export async function GET(req: Request) {
  try {
    const admin = await getAdminUser(req);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const entity_type = searchParams.get('entity_type');

    let query = supabaseAdmin
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (entity_type && entity_type !== 'all') {
      query = query.eq('entity_type', entity_type);
    }

    const { data: reports, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reports: reports || [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}

// PATCH: update report status or admin_note
export async function PATCH(req: Request) {
  try {
    const admin = await getAdminUser(req);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { id, status, admin_note } = body;

    if (!id) {
      return NextResponse.json({ error: 'Report id is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (admin_note !== undefined) updates.admin_note = admin_note;

    const { data, error } = await supabaseAdmin
      .from('reports')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ report: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}

// DELETE: permanently delete a report
export async function DELETE(req: Request) {
  try {
    const admin = await getAdminUser(req);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Report id is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('reports').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}

// POST: add a comment to a report
export async function POST(req: Request) {
  try {
    const admin = await getAdminUser(req);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { report_id, body: commentBody } = body;

    if (!report_id || !commentBody) {
      return NextResponse.json({ error: 'report_id and body are required' }, { status: 400 });
    }

    const { data: comment, error } = await supabaseAdmin
      .from('report_comments')
      .insert({
        report_id,
        admin_email: admin.email || 'admin',
        body: commentBody,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comment });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
