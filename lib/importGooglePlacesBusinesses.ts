/**
 * Admin utility to import unclaimed businesses from Google Places Text Search results.
 * Upserts by google_place_id; on conflict: do nothing if already claimed, else update non-owner fields.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { googleTypesToHanarCategory, parseFormattedAddress } from '@/utils/googlePlacesImport';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export interface GooglePlaceImportInput {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry?: {
    location?: { lat?: number; lng?: number };
  };
  types?: string[];
  rating?: number;
  user_ratings_total?: number;
  photos?: Array<{ photo_reference?: string }>;
}

function slugify(input: string): string {
  return (input || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

const FREE_PLAN_DEFAULTS = {
  max_gallery_images: 1,
  max_menu_items: 0,
  max_retail_items: 0,
  max_car_listings: 0,
  allow_social_links: false,
  allow_whatsapp: false,
  allow_promoted: false,
  allow_reviews: false,
  allow_qr: false,
};

export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ place_id: string; error: string }>;
}

async function businessSlugExists(
  supabase: SupabaseClient,
  slug: string
): Promise<boolean> {
  const { data } = await supabase
    .from('businesses')
    .select('slug')
    .eq('slug', slug)
    .maybeSingle();
  return !!data;
}

async function generateUniqueSlug(
  supabase: SupabaseClient,
  baseName: string,
  cityOrZip?: string
): Promise<string> {
  const base = slugify(baseName) || 'business';
  const suffix = (cityOrZip || '').replace(/[^a-z0-9]/g, '').slice(0, 15);
  const baseWithLoc = suffix ? `${base}-${suffix}` : base;
  let candidate = baseWithLoc;
  for (let i = 0; i < 25; i++) {
    if (!(await businessSlugExists(supabase, candidate))) return candidate;
    candidate = `${baseWithLoc}-${Math.floor(Math.random() * 10000)}`.slice(0, 50);
  }
  return `${baseWithLoc}-${Date.now().toString().slice(-4)}`.slice(0, 50);
}

/**
 * Import an array of Google Places results as unclaimed businesses.
 * - New records: insert with owner_id=null, moderation_status=on_hold.
 * - Existing by google_place_id: if owner_id is set (claimed), skip. Else update non-owner fields.
 */
export async function importGooglePlacesBusinesses(
  places: GooglePlaceImportInput[],
  supabaseAdmin?: SupabaseClient
): Promise<ImportResult> {
  const supabase =
    supabaseAdmin ||
    createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

  const result: ImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] };

  for (const place of places) {
    const placeId = (place.place_id || '').trim();
    if (!placeId) {
      result.errors.push({ place_id: '', error: 'Missing place_id' });
      continue;
    }

    const name = (place.name || '').trim();
    if (!name) {
      result.errors.push({ place_id: placeId, error: 'Missing name' });
      continue;
    }

    const address = parseFormattedAddress(place.formatted_address);
    const loc = place.geometry?.location;
    const lat = loc?.lat != null ? Number(loc.lat) : null;
    const lon = loc?.lng != null ? Number(loc.lng) : null;
    const { category, subcategory } = googleTypesToHanarCategory(place.types || []);
    const rating = place.rating != null ? Number(place.rating) : null;
    const userRatingsTotal =
      place.user_ratings_total != null ? Number(place.user_ratings_total) : null;

    const cityOrZip = address?.city || address?.zip || '';

    const { data: existing } = await supabase
      .from('businesses')
      .select('id, owner_id')
      .eq('google_place_id', placeId)
      .maybeSingle();

    if (existing) {
      if (existing.owner_id != null) {
        result.skipped++;
        continue;
      }
      const updatePayload = {
        business_name: name,
        address,
        lat,
        lon,
        category: category || null,
        subcategory: subcategory || null,
        google_rating: rating,
        google_user_ratings_total: userRatingsTotal,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('businesses')
        .update(updatePayload)
        .eq('id', existing.id);
      if (error) {
        result.errors.push({ place_id: placeId, error: error.message });
        continue;
      }
      result.updated++;
      continue;
    }

    const slug = await generateUniqueSlug(supabase, name, cityOrZip);

    const insertPayload = {
      business_name: name,
      slug,
      owner_id: null,
      google_place_id: placeId,
      google_rating: rating,
      google_user_ratings_total: userRatingsTotal,
      address,
      lat,
      lon,
      category: category || null,
      subcategory: subcategory || null,
      status: 'unclaimed',
      lifecycle_status: 'unclaimed',
      moderation_status: 'on_hold',
      is_archived: false,
      plan: 'free',
      ...FREE_PLAN_DEFAULTS,
    };

    const { data: inserted, error } = await supabase
      .from('businesses')
      .insert(insertPayload)
      .select('id')
      .single();

    if (error) {
      result.errors.push({ place_id: placeId, error: error.message });
      continue;
    }

    if (inserted?.id) {
      const { error: planErr } = await supabase.rpc('apply_business_plan', {
        p_business_id: inserted.id,
        p_plan: 'free',
        p_years: 1,
      });
      if (planErr) console.error('apply_business_plan:', planErr);
    }

    result.imported++;
  }

  return result;
}
