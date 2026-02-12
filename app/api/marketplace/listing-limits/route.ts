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

/** GET: returns listing limits for the current user (individual: free 1/30d or pack 5; business: unlimited). */
export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: biz } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (biz?.id) {
      const { count } = await supabaseAdmin
        .from('marketplace_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      return NextResponse.json({
        isBusiness: true,
        activeCount: count ?? 0,
        maxAllowed: 999,
        hasPack: false,
        packExpiresAt: null,
        canAddMore: true,
      });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - FREE_LISTING_DAYS);
    const cutoff = thirtyDaysAgo.toISOString();

    const [packRes, itemsRes] = await Promise.all([
      supabaseAdmin
        .from('individual_listing_packs')
        .select('pack_expires_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('marketplace_items')
        .select('id, created_at')
        .eq('user_id', user.id),
    ]);

    const pack = packRes.data;
    const items = (itemsRes.data || []) as { id: string; created_at: string | null }[];
    const now = new Date().toISOString();
    const hasPack = pack?.pack_expires_at ? new Date(pack.pack_expires_at) > new Date() : false;

    let activeCount: number;
    let maxAllowed: number;

    if (hasPack) {
      activeCount = Math.min(items.length, PACK_MAX);
      maxAllowed = PACK_MAX;
    } else {
      activeCount = items.filter((i) => (i.created_at || '') >= cutoff).length;
      maxAllowed = FREE_TIER_MAX;
    }

    const canAddMore = activeCount < maxAllowed;

    return NextResponse.json({
      isBusiness: false,
      activeCount,
      maxAllowed,
      hasPack,
      packExpiresAt: pack?.pack_expires_at ?? null,
      canAddMore,
    });
  } catch (err: unknown) {
    console.error('[listing-limits]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
