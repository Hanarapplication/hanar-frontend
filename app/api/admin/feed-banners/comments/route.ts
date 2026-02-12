import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const allowedRoles = ['owner', 'ceo', 'topmanager', 'manager', 'reviewer'];

async function isAdmin(): Promise<{ ok: boolean; email?: string | null }> {
  const cookieStore = await cookies();
  const role = cookieStore.get('adminRole')?.value;
  const email = cookieStore.get('adminEmail')?.value ?? null;
  return { ok: !!role && allowedRoles.includes(role), email };
}

/** GET: list comments for a feed banner */
export async function GET(req: Request) {
  try {
    const { ok } = await isAdmin();
    if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const bannerId = searchParams.get('banner_id');
    if (!bannerId) return NextResponse.json({ error: 'banner_id required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('feed_banner_comments')
      .select('id, body, author, created_at')
      .eq('feed_banner_id', bannerId)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ comments: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST: add a comment (admin only) */
export async function POST(req: Request) {
  try {
    const { ok, email } = await isAdmin();
    if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const bannerId = (body?.banner_id ?? body?.feed_banner_id) as string | undefined;
    const text = typeof body?.body === 'string' ? body.body.trim() : '';

    if (!bannerId || !text) {
      return NextResponse.json({ error: 'banner_id and body required' }, { status: 400 });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('feed_banner_comments')
      .insert({
        feed_banner_id: bannerId,
        body: text,
        author: email || 'Admin',
      })
      .select('id, body, author, created_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ comment: inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
