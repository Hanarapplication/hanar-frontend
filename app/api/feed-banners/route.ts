import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const BUCKET = 'feed-banners';
/** Banners with target cities only show to viewers within this radius (miles) of any chosen city. */
const TARGET_LOCATION_RADIUS_MILES = 20;

function getPublicUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** Haversine distance in miles between two lat/lng points. */
function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type TargetCoord = { label?: string; lat: number; lng: number };

function parseTargetCoords(raw: unknown): TargetCoord[] | null {
  if (Array.isArray(raw)) {
    return raw.filter((c): c is TargetCoord => c != null && typeof (c as TargetCoord).lat === 'number' && typeof (c as TargetCoord).lng === 'number');
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parseTargetCoords(parsed) : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Public: list active, non-expired feed banners. Optional query: age_group, gender, lang, state, lat, lon (for targeting). Banners with target cities (feed_banner_target_cities) only show to viewers within 20 miles of one of those cities. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const age_group = searchParams.get('age_group')?.trim() || null;
    const gender = searchParams.get('gender')?.trim() || null;
    const langParam = searchParams.get('lang')?.trim() || null;
    const langMultiple = searchParams.getAll('lang').map((s) => s?.trim()).filter(Boolean);
    const userLangs = langMultiple.length > 0 ? langMultiple : (langParam ? [langParam] : []);
    const state = searchParams.get('state')?.trim() || null;
    const latParam = searchParams.get('lat')?.trim();
    const lonParam = searchParams.get('lon')?.trim();
    const viewerLat = latParam ? parseFloat(latParam) : null;
    const viewerLon = lonParam ? parseFloat(lonParam) : null;
    const hasViewerCoords = viewerLat != null && !Number.isNaN(viewerLat) && viewerLon != null && !Number.isNaN(viewerLon);

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('feed_banners')
      .select('id, image_path, link_url, alt, expires_at, starts_at, audience_type, target_genders, target_age_groups, target_languages, target_locations, target_location_coords')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const byDate = (data || []).filter(
      (row) =>
        (!row.expires_at || row.expires_at >= now) &&
        (!row.starts_at || row.starts_at <= now)
    );

    const bannerIds = byDate.map((r) => r.id);
    const citiesByBanner: Record<string, { lat: number; lng: number }[]> = {};
    if (bannerIds.length > 0) {
      const { data: citiesRows } = await supabase
        .from('feed_banner_target_cities')
        .select('feed_banner_id, lat, lng')
        .in('feed_banner_id', bannerIds);
      for (const row of citiesRows || []) {
        const bid = (row as { feed_banner_id: string; lat: number; lng: number }).feed_banner_id;
        if (!citiesByBanner[bid]) citiesByBanner[bid] = [];
        citiesByBanner[bid].push({ lat: row.lat, lng: row.lng });
      }
    }

    function matchesTargeting(row: {
      id: string;
      audience_type?: string | null;
      target_genders?: string[] | null;
      target_age_groups?: string[] | null;
      target_languages?: string[] | null;
      target_locations?: string[] | null;
      target_location_coords?: unknown;
    }): boolean {
      const isUniversal = row.audience_type === 'universal';
      const tableCities = citiesByBanner[row.id];
      const fallbackCoords = parseTargetCoords(row.target_location_coords);
      const targetCoords = (tableCities && tableCities.length > 0) ? tableCities : (fallbackCoords && fallbackCoords.length > 0 ? fallbackCoords.map((c) => ({ lat: c.lat, lng: c.lng })) : null);
      const hasLocationTargeting = targetCoords && targetCoords.length > 0;

      if (isUniversal && !hasLocationTargeting) return true;

      if (hasLocationTargeting) {
        if (!hasViewerCoords) return false;
        const withinRadius = targetCoords!.some(
          (c) => distanceMiles(viewerLat!, viewerLon!, c.lat, c.lng) <= TARGET_LOCATION_RADIUS_MILES
        );
        if (!withinRadius) return false;
      } else {
        return false;
      }

      const tg = row.target_genders;
      const ta = row.target_age_groups;
      const tl = row.target_languages;
      const hasGender = Array.isArray(tg) && tg.length > 0;
      const hasAge = Array.isArray(ta) && ta.length > 0;
      const hasLang = Array.isArray(tl) && tl.length > 0;
      if (hasGender && (!gender || !tg!.includes(gender))) return false;
      if (hasAge && (!age_group || !ta!.includes(age_group))) return false;
      if (hasLang) {
        const matchLang = (userLang: string, targetLang: string) =>
          userLang === targetLang || userLang.startsWith(targetLang + '-') || targetLang.startsWith(userLang + '-');
        const anyMatch = userLangs.length > 0 && tl!.some((target) => userLangs.some((u) => matchLang(u, target)));
        if (!anyMatch) return false;
      }
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
