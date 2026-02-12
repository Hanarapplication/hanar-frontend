import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TABLE_BY_TYPE: Record<string, string> = {
  business: 'businesses',
  feed_banner: 'feed_banners',
  marketplace_item: 'marketplace_items',
  retail_item: 'retail_items',
  dealership: 'dealerships',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const type = typeof body?.type === 'string' ? body.type.trim().toLowerCase() : '';
    const id = typeof body?.id === 'string' ? body.id.trim() : '';

    const table = TABLE_BY_TYPE[type];
    if (!table || !id || !UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid type or id' }, { status: 400 });
    }

    const { error } = await supabase.rpc('increment_view_count', {
      p_table: table,
      p_id: id,
    });

    if (error) {
      console.error('[track-view]', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    console.error('[track-view]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
