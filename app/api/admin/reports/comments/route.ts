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

const allowedRoles = ['owner', 'ceo', 'topmanager', 'manager', 'reviewer', 'moderator'];

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

export async function GET(req: Request) {
  try {
    const admin = await getAdminUser(req);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const report_id = searchParams.get('report_id');

    if (!report_id) {
      return NextResponse.json({ error: 'report_id is required' }, { status: 400 });
    }

    const { data: comments, error } = await supabaseAdmin
      .from('report_comments')
      .select('*')
      .eq('report_id', report_id)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comments: comments || [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
