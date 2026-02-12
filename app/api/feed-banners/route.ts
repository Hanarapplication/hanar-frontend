import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const BUCKET = 'feed-banners';

function getPublicUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** Public: list active, non-expired feed banners for the home feed */
export async function GET() {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('feed_banners')
      .select('id, image_path, link_url, alt, expires_at, starts_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const filtered = (data || []).filter(
      (row) =>
        (!row.expires_at || row.expires_at >= now) &&
        (!row.starts_at || row.starts_at <= now)
    );

    const banners = filtered.map((row) => ({
      id: row.id,
      image: getPublicUrl(row.image_path),
      link: row.link_url || '#',
      alt: row.alt || 'Banner',
    }));

    return NextResponse.json({ banners });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
