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

function normalizeLimit(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(200, Math.floor(parsed));
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, '\\$&');
}

export async function GET(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const status = (searchParams.get('status') || 'all').trim().toLowerCase();
    const limit = normalizeLimit(searchParams.get('limit'));
    const effectiveLimit = q ? Math.max(limit, 500) : limit;
    let query = supabaseAdmin
      .from('marketplace_items')
      .select('id, user_id, title, price, location, category, condition, description, external_buy_url, image_urls, created_at, expires_at, is_on_hold, is_reviewed')
      .order('created_at', { ascending: false })
      .limit(effectiveLimit);

    if (q) {
      const escaped = escapeLike(q);
      query = query.or(
        `title.ilike.%${escaped}%,description.ilike.%${escaped}%,location.ilike.%${escaped}%,category.ilike.%${escaped}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []) as Array<Record<string, unknown>>;
    const userIds = Array.from(
      new Set(rows.map((row) => String(row.user_id || '')).filter(Boolean))
    );

    let usernameMap = new Map<string, string | null>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, username')
        .in('id', userIds);
      usernameMap = new Map(
        (profiles || []).map((row: { id: string; username: string | null }) => [row.id, row.username])
      );
    }

    const now = Date.now();
    let items: Array<Record<string, unknown>> = rows.map((row) => {
      const expiresAt = typeof row.expires_at === 'string' ? row.expires_at : null;
      const isExpired =
        !!expiresAt &&
        Number.isFinite(new Date(expiresAt).getTime()) &&
        new Date(expiresAt).getTime() < now;
      const userId = String(row.user_id || '');
      return {
        ...row,
        username: userId ? usernameMap.get(userId) || null : null,
        is_expired: isExpired,
      };
    });

    if (status === 'on_hold') {
      items = items.filter((item) => Boolean(item.is_on_hold));
    } else if (status === 'active') {
      items = items.filter((item) => !item.is_on_hold && !item.is_expired);
    } else if (status === 'expired') {
      items = items.filter((item) => item.is_expired);
    } else if (status === 'reviewed') {
      items = items.filter((item) => Boolean(item.is_reviewed));
    } else if (status === 'unreviewed') {
      items = items.filter((item) => !item.is_reviewed);
    }

    if (q) {
      const lowerQ = q.toLowerCase();
      let usernameMatches = new Set<string>();
      const { data: profileMatches } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('username', `%${escapeLike(q)}%`)
        .limit(1000);
      usernameMatches = new Set((profileMatches || []).map((row: { id: string }) => row.id));

      items = items.filter((item) => {
        const username = String(item.username || '').toLowerCase();
        const title = String(item.title || '').toLowerCase();
        const category = String(item.category || '').toLowerCase();
        const location = String(item.location || '').toLowerCase();
        const description = String(item.description || '').toLowerCase();
        const userId = String(item.user_id || '');
        return (
          usernameMatches.has(userId) ||
          username.includes(lowerQ) ||
          title.includes(lowerQ) ||
          category.includes(lowerQ) ||
          location.includes(lowerQ) ||
          description.includes(lowerQ)
        );
      });
    }

    return NextResponse.json({ items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
