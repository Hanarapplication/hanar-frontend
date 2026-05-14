import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

function resolveImageUrls(raw: unknown): string[] {
  let arr: string[] = [];
  if (Array.isArray(raw)) arr = raw.map((u) => String(u));
  else if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      arr = Array.isArray(p) ? p.map((u: unknown) => String(u)) : [raw];
    } catch {
      arr = [raw];
    }
  }
  return arr
    .map((u) => (u && String(u).startsWith('http') ? u : `${base}/storage/v1/object/public/marketplace-images/${u || ''}`))
    .filter(Boolean);
}

/** Public: get marketplace items listed by a user (for profile shop). */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id')?.trim();
    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('marketplace_items')
      .select('id, title, price, location, image_urls, created_at, expires_at, is_on_hold, is_reviewed')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const nowIso = new Date().toISOString();
    const listings = (data || [])
      .filter((row: any) => {
        if (row.is_on_hold) return false;
        if (row.is_reviewed === false) return false;
        if (row.expires_at && String(row.expires_at) < nowIso) return false;
        return true;
      })
      .map((row: any) => ({
        id: row.id,
        title: row.title || 'Item',
        price: row.price ?? '',
        location: row.location || '',
        imageUrls: resolveImageUrls(row.image_urls ?? row.imageUrls),
        created_at: row.created_at ?? null,
      }));

    return NextResponse.json({ listings });
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
