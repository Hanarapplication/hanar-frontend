import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const allowedRoles = ['owner', 'ceo', 'topmanager', 'manager', 'reviewer', 'business'];

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const role = cookieStore.get('adminRole')?.value;
  return !!role && allowedRoles.includes(role);
}

type SeedMarketplacePayload = {
  seedUsername?: string;
  title?: string;
  price?: number | string;
  location?: string;
  category?: string;
  condition?: string;
  description?: string;
  affiliationLink?: string;
  photos?: string[];
  expiresAt?: string | null;
};

function normalizePhotos(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((x) => String(x || '').trim())
    .filter(Boolean);
}

function normalizeExpiresAt(input: unknown): string | null {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  if (raw.toLowerCase() === 'never') return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .like('username', 'seed_%')
      .order('username', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const seedUsers = (data || [])
      .map((row: { username: string | null }) => row.username || '')
      .filter(Boolean);

    return NextResponse.json({ seedUsers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as SeedMarketplacePayload;
    const title = (body.title || '').trim();
    const location = (body.location || '').trim();
    const category = (body.category || '').trim();
    const condition = (body.condition || '').trim() || 'New';
    const description = (body.description || '').trim();
    const affiliationLink = (body.affiliationLink || '').trim();
    const photos = normalizePhotos(body.photos);

    const numericPrice = Number(body.price);
    if (!title || !location || !category || Number.isNaN(numericPrice) || numericPrice < 0) {
      return NextResponse.json(
        { error: 'Missing required fields: title, price (>= 0), location, category' },
        { status: 400 }
      );
    }

    const expiresAtIso = normalizeExpiresAt(body.expiresAt);
    if (body.expiresAt && !expiresAtIso && String(body.expiresAt).trim().toLowerCase() !== 'never') {
      return NextResponse.json({ error: 'Invalid expiresAt. Use ISO date string or "never".' }, { status: 400 });
    }

    const preferredSeedUsername = (body.seedUsername || '').trim().toLowerCase();
    let seedProfile:
      | {
          id: string;
          username: string | null;
        }
      | null = null;

    if (preferredSeedUsername) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, username')
        .eq('username', preferredSeedUsername)
        .maybeSingle();
      seedProfile = data ?? null;
    }

    if (!seedProfile) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, username')
        .like('username', 'seed_%')
        .order('username', { ascending: true })
        .limit(1)
        .maybeSingle();
      seedProfile = data ?? null;
    }

    if (!seedProfile?.id) {
      return NextResponse.json(
        { error: 'No seed account found. Run Community Seed first to create seed_* users.' },
        { status: 400 }
      );
    }

    const insertPayload: Record<string, unknown> = {
      user_id: seedProfile.id,
      title,
      price: numericPrice,
      location,
      category,
      condition,
      description: description || null,
      image_urls: photos,
      external_buy_url: affiliationLink || null,
      expires_at: expiresAtIso,
    };

    const { data: inserted, error } = await supabaseAdmin
      .from('marketplace_items')
      .insert(insertPayload)
      .select('id, title, user_id, created_at, expires_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Marketplace seed item created.',
      seedUser: seedProfile.username,
      item: inserted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
