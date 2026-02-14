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

const PACK_DAYS = 40;

/** POST: purchase or renew Casual Seller Pack. $19.99 for 40 days, max 5 listings. Extends pack_expires_at by +40 days from current expiry (if active) or from now (if expired). */
export async function POST(req: Request) {
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
      return NextResponse.json({ error: 'Business accounts do not use listing packs' }, { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from('individual_listing_packs')
      .select('pack_expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    const now = new Date();
    const baseExpiry = existing?.pack_expires_at && new Date(existing.pack_expires_at) > now
      ? new Date(existing.pack_expires_at)
      : now;
    const newExpires = new Date(baseExpiry);
    newExpires.setDate(newExpires.getDate() + PACK_DAYS);

    const { error: upsertError } = await supabaseAdmin
      .from('individual_listing_packs')
      .upsert(
        {
          user_id: user.id,
          pack_expires_at: newExpires.toISOString(),
          updated_at: now.toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (upsertError) {
      console.error('[casual-seller-pack]', upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      packExpiresAt: newExpires.toISOString(),
      message: 'Casual Seller Pack active. You can list up to 5 items.',
    });
  } catch (err: unknown) {
    console.error('[casual-seller-pack]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
