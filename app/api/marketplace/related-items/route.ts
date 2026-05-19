import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.warn('Related items API: missing Supabase env');
}

const supabaseAdmin = SUPABASE_URL && SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

const base = SUPABASE_URL || '';
const CATEGORY_SEPARATOR = ' — ';

type RelatedEntry = {
  id: string;
  title: string;
  price: string | number;
  slug: string;
  image: string;
  source: string;
  category?: string;
  location?: string;
  external_buy_url?: string | null;
};

function categoryMatchValues(category: string): string[] {
  const raw = category.trim();
  if (!raw) return [];
  const values = new Set<string>([raw]);
  if (raw.includes(CATEGORY_SEPARATOR)) {
    const parent = raw.slice(0, raw.indexOf(CATEGORY_SEPARATOR)).trim();
    if (parent) values.add(parent);
  }
  const alt = raw.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (alt?.[1]) values.add(alt[1].trim());
  return [...values];
}

function applyCategoryFilter<T extends { ilike: (col: string, pattern: string) => T; or: (filters: string) => T }>(
  query: T,
  category: string,
  escape: (s: string) => string,
): T {
  const tokens = categoryMatchValues(category);
  if (tokens.length === 0) return query;
  if (tokens.length === 1) {
    return query.ilike('category', `%${escape(tokens[0])}%`);
  }
  return query.or(tokens.map((token) => `category.ilike.%${escape(token)}%`).join(','));
}

function isActiveMarketplaceRow(row: {
  is_on_hold?: boolean | null;
  is_reviewed?: boolean | null;
  expires_at?: string | null;
}) {
  if (row.is_on_hold) return false;
  if (row.is_reviewed === false) return false;
  if (row.expires_at && String(row.expires_at) < new Date().toISOString()) return false;
  return true;
}

function getStorageUrl(bucket: string, path?: string | null): string {
  if (!path) return '';
  if (String(path).startsWith('http')) return String(path);
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

function normalizeImages(value: unknown, bucket: string): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => getStorageUrl(bucket, String(item))).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item: unknown) => getStorageUrl(bucket, String(item))).filter(Boolean);
      }
      return [getStorageUrl(bucket, value)].filter(Boolean);
    } catch {
      return [getStorageUrl(bucket, value)].filter(Boolean);
    }
  }
  return [];
}

/** GET: related items by category/location or recent. Uses service role so RLS does not block. */
export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ items: [] });
  }
  try {
    const { searchParams } = new URL(req.url);
    const excludeId = searchParams.get('excludeId')?.trim();
    const source = searchParams.get('source')?.trim() || 'individual';
    const category = searchParams.get('category')?.trim() || '';
    const location = searchParams.get('location')?.trim() || '';
    const hasCategory = category.length > 0;
    const hasLocation = location.length > 0;
    const hasFilter = hasCategory || hasLocation;
    const externalOnly =
      searchParams.get('externalOnly') === '1' || searchParams.get('externalOnly') === 'true';
    const escape = (s: string) => s.replace(/'/g, "''");

    const items: RelatedEntry[] = [];
    const seen = new Set<string>();

    const add = (entry: RelatedEntry) => {
      const key = `${entry.source}:${entry.id}`;
      if (seen.has(key)) return;
      if (excludeId && entry.id === excludeId && entry.source === source) return;
      seen.add(key);
      items.push(entry);
    };

    const loadIndividualItems = async (opts: { externalOnly: boolean; limit: number }) => {
      let qInd = supabaseAdmin!
        .from('marketplace_items')
        .select('id, title, price, location, category, image_urls, external_buy_url, expires_at, is_on_hold, is_reviewed')
        .is('archived_at', null);
      if (excludeId && source === 'individual') qInd = qInd.neq('id', excludeId);
      if (opts.externalOnly) qInd = qInd.not('external_buy_url', 'is', null);
      if (hasCategory) {
        qInd = applyCategoryFilter(qInd, category, escape);
      } else if (hasLocation && !opts.externalOnly) {
        qInd = qInd.ilike('location', `%${escape(location)}%`);
      } else {
        qInd = qInd.order('created_at', { ascending: false });
      }
      const { data: rowsInd, error: errInd } = await qInd.limit(opts.limit);
      if (errInd || !rowsInd?.length) return;
      for (const row of rowsInd as any[]) {
        if (!isActiveMarketplaceRow(row)) continue;
        const externalUrl = String(row.external_buy_url || '').trim();
        if (opts.externalOnly && !externalUrl) continue;
        const imgs = normalizeImages(row.image_urls, 'marketplace-images');
        add({
          id: String(row.id),
          title: row.title || 'Item',
          price: row.price ?? '',
          slug: `individual-${row.id}`,
          image: imgs[0] || '/placeholder.jpg',
          source: 'individual',
          category: row.category || undefined,
          location: row.location || undefined,
          external_buy_url: externalUrl || null,
        });
      }
    };

    const loadRetailItems = async (opts: { externalOnly: boolean; limit: number }) => {
      try {
        let qRet = supabaseAdmin!
          .from('retail_items')
          .select('id, title, price, location, category, images, image_url, image_urls, slug, external_buy_url');
        if (excludeId && source === 'retail') qRet = qRet.neq('id', excludeId);
        if (opts.externalOnly) qRet = qRet.not('external_buy_url', 'is', null);
        if (hasCategory) {
          qRet = applyCategoryFilter(qRet, category, escape);
        } else if (hasLocation && !opts.externalOnly) {
          qRet = qRet.ilike('location', `%${escape(location)}%`);
        } else {
          qRet = qRet.order('created_at', { ascending: false });
        }
        const { data: rowsRet } = await qRet.limit(opts.limit);
        (rowsRet || []).forEach((row: any) => {
          const externalUrl = String(row.external_buy_url || '').trim();
          if (opts.externalOnly && !externalUrl) return;
          const imgs = normalizeImages(row.images ?? row.image_url ?? row.image_urls, 'retail-items');
          add({
            id: String(row.id),
            title: row.title || row.name || row.item_name || 'Item',
            price: row.price ?? row.amount ?? row.cost ?? '',
            slug: row.slug || row.item_slug || `retail-${row.id}`,
            image: imgs[0] || '/placeholder.jpg',
            source: 'retail',
            category: row.category || row.type || undefined,
            location: row.location || row.city || undefined,
            external_buy_url: externalUrl || null,
          });
        });
      } catch (_) {
        // table may not exist
      }
    };

    if (externalOnly) {
      await loadIndividualItems({ externalOnly: true, limit: 12 });
      if (items.length < 12) {
        await loadRetailItems({ externalOnly: true, limit: 12 - items.length });
      }
      if (items.length < 6 && hasCategory) {
        await loadIndividualItems({ externalOnly: false, limit: 12 - items.length });
        if (items.length < 12) {
          await loadRetailItems({ externalOnly: false, limit: 12 - items.length });
        }
      }
      return NextResponse.json({ items: items.slice(0, 12) });
    }

    // Marketplace (individual) items
    let qInd = supabaseAdmin
      .from('marketplace_items')
      .select('id, title, price, location, category, image_urls, external_buy_url, expires_at, is_on_hold, is_reviewed')
      .is('archived_at', null);
    if (excludeId && source === 'individual') qInd = qInd.neq('id', excludeId);
    if (hasFilter) {
      if (hasCategory) qInd = applyCategoryFilter(qInd, category, escape);
      else if (hasLocation) qInd = qInd.ilike('location', `%${escape(location)}%`);
    } else {
      qInd = qInd.order('created_at', { ascending: false });
    }
    const { data: rowsInd, error: errInd } = await qInd.limit(12);
    if (!errInd && rowsInd?.length) {
      for (const row of rowsInd as any[]) {
        if (!isActiveMarketplaceRow(row)) continue;
        const imgs = normalizeImages(row.image_urls, 'marketplace-images');
        add({
          id: String(row.id),
          title: row.title || 'Item',
          price: row.price ?? '',
          slug: `individual-${row.id}`,
          image: imgs[0] || '/placeholder.jpg',
          source: 'individual',
          category: row.category || undefined,
          location: row.location || undefined,
          external_buy_url: String(row.external_buy_url || '').trim() || null,
        });
      }
    }

    // Retail (optional)
    try {
      let qRet = supabaseAdmin.from('retail_items').select('id, title, price, location, category, images, image_url, image_urls, slug, external_buy_url');
      if (excludeId && source === 'retail') qRet = qRet.neq('id', excludeId);
      if (hasFilter) {
        if (hasCategory) qRet = applyCategoryFilter(qRet, category, escape);
        else if (hasLocation) qRet = qRet.ilike('location', `%${escape(location)}%`);
      } else {
        qRet = qRet.order('created_at', { ascending: false });
      }
      const { data: rowsRet } = await qRet.limit(6);
      (rowsRet || []).forEach((row: any) => {
        const imgs = normalizeImages(row.images ?? row.image_url ?? row.image_urls, 'retail-items');
        add({
          id: String(row.id),
          title: row.title || row.name || row.item_name || 'Item',
          price: row.price ?? row.amount ?? row.cost ?? '',
          slug: row.slug || row.item_slug || `retail-${row.id}`,
          image: imgs[0] || '/placeholder.jpg',
          source: 'retail',
          category: row.category || row.type || undefined,
          location: row.location || row.city || undefined,
          external_buy_url: String(row.external_buy_url || '').trim() || null,
        });
      });
    } catch (_) {
      // table may not exist
    }

    // Dealerships (optional)
    try {
      let qDeal = supabaseAdmin.from('dealerships').select('id, title, price, location, category, images, image_url, image_urls, slug');
      if (excludeId && source === 'dealership') qDeal = qDeal.neq('id', excludeId);
      if (hasFilter) {
        if (hasCategory) qDeal = qDeal.ilike('category', `%${escape(category)}%`);
        else if (hasLocation) qDeal = qDeal.ilike('location', `%${escape(location)}%`);
      } else {
        qDeal = qDeal.order('created_at', { ascending: false });
      }
      const { data: rowsDeal } = await qDeal.limit(6);
      (rowsDeal || []).forEach((row: any) => {
        const imgs = normalizeImages(row.images ?? row.image_url ?? row.image_urls ?? row.photos, 'car-listings');
        add({
          id: String(row.id),
          title: row.title || row.name || row.vehicle_name || row.model || 'Item',
          price: row.price ?? row.amount ?? row.cost ?? '',
          slug: row.slug || row.item_slug || `dealership-${row.id}`,
          image: imgs[0] || '/placeholder.jpg',
          source: 'dealership',
          category: row.category || row.type || undefined,
          location: row.location || row.city || undefined,
        });
      });
    } catch (_) {
      // table may not exist
    }

    return NextResponse.json({ items: items.slice(0, 12) });
  } catch (err) {
    return NextResponse.json({ items: [] });
  }
}
