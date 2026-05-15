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
    .map((u) => {
      const s = String(u || '').trim();
      if (!s) return '';
      if (s.startsWith('http')) return s;
      return `${base}/storage/v1/object/public/marketplace-images/${s}`;
    })
    .filter(Boolean);
}

function rowToFormPayload(row: Record<string, unknown>) {
  const rawContact = row.contact;
  let contact = { phone: '', whatsapp: '', email: '' };
  if (rawContact && typeof rawContact === 'object' && !Array.isArray(rawContact)) {
    const c = rawContact as Record<string, unknown>;
    contact = {
      phone: String(c.phone ?? ''),
      whatsapp: String(c.whatsapp ?? ''),
      email: String(c.email ?? ''),
    };
  } else {
    contact = {
      phone: String(row.contact_phone ?? ''),
      whatsapp: String(row.contact_whatsapp ?? ''),
      email: String(row.contact_email ?? ''),
    };
  }

  const priceVal = row.price;
  const priceStr =
    priceVal == null ? '' : typeof priceVal === 'number' ? String(priceVal) : String(priceVal);

  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    price: priceStr,
    location: String(row.location ?? ''),
    locationCity: String(row.location_city ?? ''),
    locationState: String(row.location_state ?? ''),
    locationCountry: String(row.location_country ?? ''),
    locationZip: String(row.location_zip ?? ''),
    locationLat: (row.location_lat as number | null) ?? null,
    locationLng: (row.location_lng as number | null) ?? null,
    category: String(row.category ?? ''),
    condition: String(row.condition ?? 'Used'),
    contact,
    make: String(row.make ?? ''),
    model: String(row.model ?? ''),
    year: String(row.year ?? ''),
    mileage: String(row.mileage ?? ''),
    description: String(row.description ?? ''),
    imageUrls: resolveImageUrls(row.image_urls ?? row.imageUrls),
    externalBuyUrl: String((row as { external_buy_url?: string }).external_buy_url ?? ''),
  };
}

/** GET: load one marketplace_items row for the owner (edit form). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { data: row, error } = await supabaseAdmin
      .from('marketplace_items')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (row.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (row.archived_at) return NextResponse.json({ error: 'Listing removed' }, { status: 400 });

    return NextResponse.json({ item: rowToFormPayload(row as Record<string, unknown>) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH: owner updates listing fields (moderation flags unchanged). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('marketplace_items')
      .select('id, user_id, archived_at')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (existing.archived_at) return NextResponse.json({ error: 'Listing removed' }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const payload: Record<string, unknown> = {};

    if (typeof body.title === 'string') payload.title = body.title.trim();
    if (body.price !== undefined && body.price !== '') {
      const n = typeof body.price === 'number' ? body.price : parseFloat(String(body.price));
      if (!Number.isNaN(n)) payload.price = n;
    }
    if (typeof body.location === 'string') payload.location = body.location.trim();
    if (typeof body.location_city === 'string') payload.location_city = body.location_city.trim() || null;
    if (typeof body.location_state === 'string') payload.location_state = body.location_state.trim() || null;
    if (typeof body.location_country === 'string') payload.location_country = body.location_country.trim() || null;
    if (typeof body.location_zip === 'string') payload.location_zip = body.location_zip.trim() || null;
    if (body.location_lat === null || typeof body.location_lat === 'number') payload.location_lat = body.location_lat;
    if (body.location_lng === null || typeof body.location_lng === 'number') payload.location_lng = body.location_lng;
    if (typeof body.category === 'string') payload.category = body.category.trim();
    if (typeof body.condition === 'string') payload.condition = body.condition.trim();
    if (typeof body.description === 'string') payload.description = body.description.trim();
    if (Array.isArray(body.image_urls)) payload.image_urls = body.image_urls.map((u) => String(u)).filter(Boolean);
    if (typeof body.external_buy_url === 'string') {
      payload.external_buy_url = body.external_buy_url.trim() || null;
    }
    if (body.contact && typeof body.contact === 'object' && !Array.isArray(body.contact)) {
      payload.contact = body.contact;
    }
    if (typeof body.make === 'string') payload.make = body.make.trim() || null;
    if (typeof body.model === 'string') payload.model = body.model.trim() || null;
    if (typeof body.year === 'string') payload.year = body.year.trim() || null;
    if (typeof body.mileage === 'string') payload.mileage = body.mileage.trim() || null;

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    const { data: updated, error: upErr } = await supabaseAdmin
      .from('marketplace_items')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, title')
      .maybeSingle();

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

    return NextResponse.json({ success: true, item: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
