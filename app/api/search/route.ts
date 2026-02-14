import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export type SearchResultItem = {
  type: 'user' | 'business' | 'organization';
  label: string;
  subtitle: string | null;
  imageUrl: string | null;
  href: string;
};

function ensureFullImageUrl(url: string | null | undefined, base: string): string | null {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const u = url.trim();
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return `${base}${u}`;
  return `${base}/storage/v1/object/public/${u}`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') ?? '').trim().replace(/%/g, '');
    if (!q) {
      return NextResponse.json({ results: [] });
    }
    const term = `%${q}%`;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

    const results: SearchResultItem[] = [];

    // Organizations: name + handle @username
    const { data: orgs } = await supabaseAdmin
      .from('organizations')
      .select('username, full_name, logo_url')
      .or(`full_name.ilike.${term},username.ilike.${term}`)
      .not('username', 'is', null)
      .limit(10);
    for (const o of orgs ?? []) {
      const username = (o as { username?: string }).username;
      if (username) {
        results.push({
          type: 'organization',
          label: (o as { full_name?: string }).full_name || username,
          subtitle: `@${username}`,
          imageUrl: ensureFullImageUrl((o as { logo_url?: string }).logo_url, base),
          href: `/organization/${encodeURIComponent(username)}`,
        });
      }
    }

    // Businesses: name + handle @slug
    const { data: bizList } = await supabaseAdmin
      .from('businesses')
      .select('slug, business_name, logo_url')
      .or(`business_name.ilike.${term},slug.ilike.${term}`)
      .not('slug', 'is', null)
      .limit(10);
    for (const b of bizList ?? []) {
      const slug = (b as { slug: string }).slug;
      if (slug) {
        results.push({
          type: 'business',
          label: (b as { business_name?: string }).business_name || slug,
          subtitle: `@${slug}`,
          imageUrl: ensureFullImageUrl((b as { logo_url?: string }).logo_url, base),
          href: `/business/${encodeURIComponent(slug)}`,
        });
      }
    }

    // Users (profiles): username for URL, profile_pic_url
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('username, profile_pic_url')
      .or(`username.ilike.${term}`)
      .not('username', 'is', null)
      .limit(10);
    for (const p of profiles ?? []) {
      const username = (p as { username: string }).username;
      if (username) {
        results.push({
          type: 'user',
          label: username,
          subtitle: `@${username}`,
          imageUrl: ensureFullImageUrl((p as { profile_pic_url?: string }).profile_pic_url, base),
          href: `/profile/${encodeURIComponent(username)}`,
        });
      }
    }

    // Also search registeredaccounts for individuals (username / full_name) and map to profile for pic
    const { data: raList } = await supabaseAdmin
      .from('registeredaccounts')
      .select('user_id, username, full_name')
      .eq('business', false)
      .eq('organization', false)
      .not('user_id', 'is', null)
      .or(`username.ilike.${term},full_name.ilike.${term}`)
      .limit(15);
    const seenUserIds = new Set(results.filter((r) => r.type === 'user').map((r) => r.href));
    const userIds = (raList ?? []).map((r) => (r as { user_id: string }).user_id).filter(Boolean);
    if (userIds.length > 0) {
      const { data: profData } = await supabaseAdmin
        .from('profiles')
        .select('id, username, profile_pic_url')
        .in('id', userIds);
      const byId = new Map((profData ?? []).map((p) => [(p as { id: string }).id, p]));
      for (const r of raList ?? []) {
        const uid = (r as { user_id: string }).user_id;
        const profile = byId.get(uid) as { username: string; profile_pic_url?: string } | undefined;
        const username = profile?.username ?? (r as { username?: string }).username;
        if (!username) continue;
        const href = `/profile/${encodeURIComponent(username)}`;
        if (seenUserIds.has(href)) continue;
        seenUserIds.add(href);
        const label = (r as { full_name?: string }).full_name?.trim() || username;
        results.push({
          type: 'user',
          label,
          subtitle: `@${username}`,
          imageUrl: profile
            ? ensureFullImageUrl(profile.profile_pic_url, base)
            : null,
          href,
        });
      }
    }

    return NextResponse.json({ results: results.slice(0, 20) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
