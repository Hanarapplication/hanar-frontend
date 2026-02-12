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

/** Public: list active, non-expired feed banners. Optional query: age_group, gender, lang, state (for targeting). */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const age_group = searchParams.get('age_group')?.trim() || null;
    const gender = searchParams.get('gender')?.trim() || null;
    const langParam = searchParams.get('lang')?.trim() || null;
    const langMultiple = searchParams.getAll('lang').map((s) => s?.trim()).filter(Boolean);
    const userLangs = langMultiple.length > 0 ? langMultiple : (langParam ? [langParam] : []);
    const state = searchParams.get('state')?.trim() || null;

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('feed_banners')
      .select('id, image_path, link_url, alt, expires_at, starts_at, audience_type, target_genders, target_age_groups, target_languages, target_locations')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const byDate = (data || []).filter(
      (row) =>
        (!row.expires_at || row.expires_at >= now) &&
        (!row.starts_at || row.starts_at <= now)
    );

    function matchesTargeting(row: {
      audience_type?: string | null;
      target_genders?: string[] | null;
      target_age_groups?: string[] | null;
      target_languages?: string[] | null;
      target_locations?: string[] | null;
    }): boolean {
      if (row.audience_type === 'universal') return true;
      if (row.audience_type !== 'targeted') return true;
      const tg = row.target_genders;
      const ta = row.target_age_groups;
      const tl = row.target_languages;
      const tloc = row.target_locations;
      const hasGender = Array.isArray(tg) && tg.length > 0;
      const hasAge = Array.isArray(ta) && ta.length > 0;
      const hasLang = Array.isArray(tl) && tl.length > 0;
      const hasLoc = Array.isArray(tloc) && tloc.length > 0;
      if (!hasGender && !hasAge && !hasLang && !hasLoc) return true;
      if (hasGender && (!gender || !tg!.includes(gender))) return false;
      if (hasAge && (!age_group || !ta!.includes(age_group))) return false;
      if (hasLang) {
        const matchLang = (userLang: string, targetLang: string) =>
          userLang === targetLang || userLang.startsWith(targetLang + '-') || targetLang.startsWith(userLang + '-');
        const anyMatch = userLangs.length > 0 && tl!.some((target) => userLangs.some((u) => matchLang(u, target)));
        if (!anyMatch) return false;
      }
      if (hasLoc && (!state || !tloc!.some((loc) => loc.toLowerCase().includes(state.toLowerCase())))) return false;
      return true;
    }

    const filtered = byDate.filter((row) => matchesTargeting(row));

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
