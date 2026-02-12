import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BUCKET = 'feed-banners';
const allowedRoles = ['owner', 'ceo', 'topmanager', 'manager', 'reviewer'];

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const role = cookieStore.get('adminRole')?.value;
  return !!role && allowedRoles.includes(role);
}

/** Admin: download banner image by id (returns file with Content-Disposition) */
export async function GET(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const { data: row, error: fetchError } = await supabaseAdmin
      .from('feed_banners')
      .select('image_path')
      .eq('id', id)
      .single();

    if (fetchError || !row?.image_path) {
      return NextResponse.json({ error: 'Banner not found' }, { status: 404 });
    }

    const { data: blob, error: downloadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(row.image_path);

    if (downloadError || !blob) {
      return NextResponse.json({ error: 'Failed to download image' }, { status: 500 });
    }

    const filename = row.image_path.split('/').pop() || `banner-${id}.jpg`;
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
