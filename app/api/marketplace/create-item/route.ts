import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function getAuthenticatedUser(req: Request): Promise<{ id: string } | null> {
  const supabaseServer = createRouteHandlerClient({ cookies });
  const { data: { user }, error } = await supabaseServer.auth.getUser();
  if (!error && user) return user;
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;
  if (ANON_KEY) {
    const client = createClient(SUPABASE_URL!, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user: u } } = await client.auth.getUser();
    if (u) return u;
  }
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data?.user ?? null;
}

const FREE_TIER_MAX = 1;
const PACK_MAX = 5;
const FREE_LISTING_DAYS = 30;

/** POST: create a marketplace item. Enforces individual listing limits (free: 1 active/30d, pack: 5 max). */
export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { data: biz } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!biz?.id) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - FREE_LISTING_DAYS);
      const cutoff = thirtyDaysAgo.toISOString();
      const [packRes, itemsRes] = await Promise.all([
        supabaseAdmin.from('individual_listing_packs').select('pack_expires_at').eq('user_id', user.id).maybeSingle(),
        supabaseAdmin.from('marketplace_items').select('id, created_at').eq('user_id', user.id),
      ]);
      const pack = packRes.data;
      const items = (itemsRes.data || []) as { id: string; created_at: string | null }[];
      const hasPack = pack?.pack_expires_at ? new Date(pack.pack_expires_at) > new Date() : false;
      const activeCount = hasPack
        ? Math.min(items.length, PACK_MAX)
        : items.filter((i) => (i.created_at || '') >= cutoff).length;
      const maxAllowed = hasPack ? PACK_MAX : FREE_TIER_MAX;
      if (activeCount >= maxAllowed) {
        return NextResponse.json(
          { error: hasPack ? 'You have reached the maximum of 5 listings.' : 'Free tier allows 1 active listing (30 days). Delete one or get the Casual Seller Pack to list more.' },
          { status: 400 }
        );
      }
    }

    const insertPayload: Record<string, unknown> = {
      ...body,
      user_id: user.id,
    };
    delete (insertPayload as any).id;

    const { data: inserted, error } = await supabaseAdmin
      .from('marketplace_items')
      .insert(insertPayload)
      .select('id, title, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, item: inserted });
  } catch (err: unknown) {
    console.error('[marketplace create-item]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
