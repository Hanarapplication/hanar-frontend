import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import {
  importGooglePlacesBusinesses,
  type GooglePlaceImportInput,
} from '@/lib/importGooglePlacesBusinesses';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const allowedRoles = [
  'owner', 'ceo', 'topmanager', 'manager',
  'reviewer', 'moderator', 'support', 'editor', 'readonly', 'business',
];

async function verifyAdmin(req: Request): Promise<{ id: string; email: string } | null> {
  let user: { id: string; email?: string } | null = null;

  const supabaseServer = createRouteHandlerClient({ cookies });
  const { data: { user: cookieUser }, error } = await supabaseServer.auth.getUser();
  if (!error && cookieUser) user = cookieUser;

  if (!user && req && ANON_KEY) {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (token) {
      const supabaseAnon = createClient(SUPABASE_URL!, ANON_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user: tokenUser } } = await supabaseAnon.auth.getUser();
      if (tokenUser) user = tokenUser;
    }
  }

  if (!user?.id || !user?.email) return null;

  const { data: adminData } = await supabaseAdmin
    .from('adminaccounts')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  const roleData =
    adminData ??
    (await supabaseAdmin.from('adminaccounts').select('role').eq('email', user.email!.toLowerCase()).maybeSingle())
      .data;

  if (!roleData?.role || !allowedRoles.includes(roleData.role)) return null;
  return { id: user.id, email: user.email };
}

export async function POST(req: Request) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

    const { places } = body as { places?: unknown[] };

    if (!Array.isArray(places) || places.length === 0) {
      return NextResponse.json(
        { error: 'places must be a non-empty array of Google Places results' },
        { status: 400 }
      );
    }

    if (places.length > 200) {
      return NextResponse.json(
        { error: 'Maximum 200 places per request' },
        { status: 400 }
      );
    }

    const normalized: GooglePlaceImportInput[] = places.map((p: unknown) => {
      const o = p as Record<string, unknown>;
      const geom = o.geometry;
      const loc =
        geom && typeof geom === 'object' && geom !== null && 'location' in geom
          ? (geom as { location?: { lat?: number; lng?: number } }).location
          : undefined;
      return {
        place_id: String(o.place_id ?? ''),
        name: String(o.name ?? ''),
        formatted_address:
          typeof o.formatted_address === 'string' ? o.formatted_address : undefined,
        geometry: loc ? { location: loc } : undefined,
        types: Array.isArray(o.types) ? o.types.map(String) : [],
        rating: typeof o.rating === 'number' ? o.rating : undefined,
        user_ratings_total:
          typeof o.user_ratings_total === 'number' ? o.user_ratings_total : undefined,
        photos: Array.isArray(o.photos) ? o.photos : [],
      };
    });

    const result = await importGooglePlacesBusinesses(normalized, supabaseAdmin);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('import-google-businesses error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
