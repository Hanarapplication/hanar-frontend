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
    const escape = (s: string) => s.replace(/'/g, "''");

    const items: { id: string; title: string; price: string | number; slug: string; image: string; source: string; category?: string; location?: string }[] = [];
    const seen = new Set<string>();

    const add = (entry: { id: string; source: string; title: string; price: string | number; slug: string; image: string; category?: string; location?: string }) => {
      const key = `${entry.source}:${entry.id}`;
      if (seen.has(key)) return;
      if (excludeId && entry.id === excludeId && entry.source === source) return;
      seen.add(key);
      items.push(entry);
    };

    // Marketplace (individual) items
    let qInd = supabaseAdmin.from('marketplace_items').select('id, title, price, location, category, image_urls');
    if (excludeId && source === 'individual') qInd = qInd.neq('id', excludeId);
    if (hasFilter) {
      if (hasCategory) qInd = qInd.ilike('category', `%${escape(category)}%`);
      else if (hasLocation) qInd = qInd.ilike('location', `%${escape(location)}%`);
    } else {
      qInd = qInd.order('created_at', { ascending: false });
    }
    const { data: rowsInd, error: errInd } = await qInd.limit(12);
    if (!errInd && rowsInd?.length) {
      for (const row of rowsInd as any[]) {
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
        });
      }
    }

    // Retail (optional)
    try {
      let qRet = supabaseAdmin.from('retail_items').select('id, title, price, location, category, images, image_url, image_urls, slug');
      if (excludeId && source === 'retail') qRet = qRet.neq('id', excludeId);
      if (hasFilter) {
        if (hasCategory) qRet = qRet.ilike('category', `%${escape(category)}%`);
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
