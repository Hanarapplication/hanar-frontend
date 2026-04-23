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

function normalizeDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const payload: Record<string, unknown> = {};

    if (typeof body.title === 'string') payload.title = body.title.trim();
    if (body.price !== undefined) payload.price = body.price;
    if (typeof body.location === 'string') payload.location = body.location.trim();
    if (typeof body.category === 'string') payload.category = body.category.trim();
    if (typeof body.condition === 'string') payload.condition = body.condition.trim();
    if (typeof body.description === 'string') payload.description = body.description.trim();
    if (typeof body.external_buy_url === 'string') {
      payload.external_buy_url = body.external_buy_url.trim() || null;
    }
    if (body.is_on_hold !== undefined) payload.is_on_hold = Boolean(body.is_on_hold);
    if (body.is_reviewed !== undefined) payload.is_reviewed = Boolean(body.is_reviewed);

    const expiresAt = normalizeDate(body.expires_at);
    if (body.expires_at !== undefined && expiresAt === undefined) {
      return NextResponse.json({ error: 'Invalid expires_at' }, { status: 400 });
    }
    if (expiresAt !== undefined) payload.expires_at = expiresAt;

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('marketplace_items')
      .update(payload)
      .eq('id', id)
      .select('id, title, price, location, category, condition, description, external_buy_url, image_urls, created_at, expires_at, is_on_hold, is_reviewed, user_id')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ item: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('marketplace_items')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
