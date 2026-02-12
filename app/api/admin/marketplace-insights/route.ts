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

export async function GET(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const radiusParam = searchParams.get('radius');
    const radiusMiles =
      radiusParam === 'unlimited' || radiusParam === '' || radiusParam == null
        ? null
        : Number(radiusParam);

    if (
      radiusParam != null &&
      radiusParam !== 'unlimited' &&
      (radiusMiles == null || Number.isNaN(radiusMiles) || radiusMiles < 0)
    ) {
      return NextResponse.json({ error: 'Invalid radius' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc('get_marketplace_top_searches', {
      p_radius_miles: radiusMiles,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const topSearches = (data || []).map((row: { term: string; count: number }) => ({
      term: row.term || '',
      count: Number(row.count) || 0,
    }));

    return NextResponse.json({
      topSearches,
      radius: radiusMiles === null || radiusMiles === undefined ? 'unlimited' : radiusMiles,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
