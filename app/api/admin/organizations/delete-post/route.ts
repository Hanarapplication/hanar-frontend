import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const allowedRoles = ['owner', 'ceo', 'topmanager', 'manager', 'reviewer'];

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const role = cookieStore.get('adminRole')?.value;
  return !!role && allowedRoles.includes(role);
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const postId = body?.postId ?? body?.post_id;
  if (!postId) return NextResponse.json({ error: 'Missing postId' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('community_posts')
    .update({ deleted: true })
    .eq('id', postId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
