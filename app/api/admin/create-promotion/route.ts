import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { sendApprovalNotification } from '@/lib/sendApprovalNotification';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = 'feed-banners';
const allowedRoles = ['owner', 'ceo', 'topmanager', 'manager', 'reviewer', 'business'];

type Source = 'business' | 'organization';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const role = cookieStore.get('adminRole')?.value;
  return !!role && allowedRoles.includes(role);
}

type TargetCoord = { label?: string; lat: number; lng: number };
function parseTargetCoords(raw: unknown): TargetCoord[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((c): c is TargetCoord => c != null && typeof (c as TargetCoord).lat === 'number' && typeof (c as TargetCoord).lng === 'number');
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parseTargetCoords(parsed) : [];
    } catch { return []; }
  }
  return [];
}

const MAX_CITIES_BY_TIER: Record<string, number> = { basic: 3, targeted: 10, premium: 100 };

async function syncBannerTargetCities(feedBannerId: string, targetLocationCoords: unknown, tier?: string | null): Promise<void> {
  let coords = parseTargetCoords(targetLocationCoords);
  if (coords.length === 0) return;
  const max = tier ? (MAX_CITIES_BY_TIER[tier] ?? 100) : 100;
  coords = coords.slice(0, max);
  await supabaseAdmin.from('feed_banner_target_cities').delete().eq('feed_banner_id', feedBannerId);
  await supabaseAdmin.from('feed_banner_target_cities').insert(
    coords.map((c) => ({ feed_banner_id: feedBannerId, city_label: c.label ?? null, lat: c.lat, lng: c.lng }))
  );
}

/**
 * POST: Admin creates a promotion for a business or organization without payment.
 * Same logic as business promotion requests, but skips Stripe and sets status pending_review,
 * then auto-approves (creates feed_banner, marks approved).
 */
export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const formData = await req.formData();
    const source = (formData.get('source') as string)?.trim()?.toLowerCase() as Source;
    const business_id = (formData.get('business_id') as string)?.trim();
    const organization_id = (formData.get('organization_id') as string)?.trim();

    if (source !== 'business' && source !== 'organization') {
      return NextResponse.json({ error: 'source must be business or organization' }, { status: 400 });
    }
    const entityId = source === 'business' ? business_id : organization_id;
    if (!entityId) {
      return NextResponse.json(
        { error: source === 'business' ? 'business_id required' : 'organization_id required' },
        { status: 400 }
      );
    }

    // Verify entity exists
    if (source === 'business') {
      const { data: biz } = await supabaseAdmin.from('businesses').select('id, slug').eq('id', entityId).single();
      if (!biz) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    } else {
      const { data: org } = await supabaseAdmin.from('organizations').select('id, username').eq('id', entityId).single();
      if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const placement = (formData.get('placement') as string)?.trim();
    const audience_type = ((formData.get('audience_type') as string)?.trim() || 'universal') as 'universal' | 'targeted';
    const link_type = (formData.get('link_type') as string)?.trim();
    const link_value = (formData.get('link_value') as string)?.trim() || '';
    const description = (formData.get('description') as string)?.trim() || '';
    const tier = (formData.get('tier') as string)?.trim();
    const duration_days = parseInt(String(formData.get('duration_days') || '0'), 10);
    const file = formData.get('image') as File | null;

    let target_genders: string[] | null = null;
    let target_age_groups: string[] | null = null;
    let target_languages: string[] | null = null;
    let target_locations: string[] | null = null;
    if (audience_type === 'targeted') {
      try {
        const tg = formData.get('target_genders');
        target_genders = tg ? (typeof tg === 'string' ? JSON.parse(tg) : []) : null;
        if (Array.isArray(target_genders) && target_genders.length === 0) target_genders = null;
      } catch { target_genders = null; }
      try {
        const ta = formData.get('target_age_groups');
        target_age_groups = ta ? (typeof ta === 'string' ? JSON.parse(ta) : []) : null;
        if (Array.isArray(target_age_groups) && target_age_groups.length === 0) target_age_groups = null;
      } catch { target_age_groups = null; }
      try {
        const tl = formData.get('target_languages');
        target_languages = tl ? (typeof tl === 'string' ? JSON.parse(tl) : []) : null;
        if (Array.isArray(target_languages) && target_languages.length === 0) target_languages = null;
      } catch { target_languages = null; }
      try {
        const tloc = formData.get('target_locations');
        target_locations = tloc ? (typeof tloc === 'string' ? JSON.parse(tloc) : []) : null;
        if (Array.isArray(target_locations) && target_locations.length === 0) target_locations = null;
      } catch { target_locations = null; }
    }

    let target_location_coords: Array<{ label: string; lat: number; lng: number }> | null = null;
    try {
      const raw = formData.get('target_location_coords');
      if (raw && typeof raw === 'string') {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          target_location_coords = parsed.filter(
            (c: unknown) => c && typeof c === 'object' && typeof (c as { lat?: unknown }).lat === 'number' && typeof (c as { lng?: unknown }).lng === 'number'
          ) as Array<{ label: string; lat: number; lng: number }>;
          if (target_location_coords.length === 0) target_location_coords = null;
        }
      }
    } catch { target_location_coords = null; }
    if (!target_locations && target_location_coords?.length) {
      target_locations = target_location_coords.map((c) => c.label ?? '');
    }
    try {
      const tloc = formData.get('target_locations');
      if (tloc && typeof tloc === 'string' && !target_locations) {
        const parsed = JSON.parse(tloc);
        target_locations = Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
      }
    } catch { /* keep existing */ }

    if (!['home_feed', 'community', 'universal'].includes(placement || '')) {
      return NextResponse.json({ error: 'Invalid placement' }, { status: 400 });
    }
    if (audience_type !== 'universal' && audience_type !== 'targeted') {
      return NextResponse.json({ error: 'Invalid audience_type' }, { status: 400 });
    }
    const validLinkTypes = source === 'business' ? ['business_page', 'external'] : ['organization_page', 'external'];
    if (!validLinkTypes.includes(link_type || '')) {
      return NextResponse.json({ error: 'Invalid link_type' }, { status: 400 });
    }
    if (!['basic', 'targeted', 'premium'].includes(tier || '')) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }
    if (!duration_days || duration_days < 1) {
      return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });
    }

    const maxCities = MAX_CITIES_BY_TIER[tier || 'basic'] ?? 100;
    if (target_location_coords && target_location_coords.length > maxCities) {
      target_location_coords = target_location_coords.slice(0, maxCities);
    }
    if (target_locations && target_locations.length > maxCities) {
      target_locations = target_locations.slice(0, maxCities);
    }

    const imagePrefix = source === 'organization' ? 'org-placards/' : '';
    let image_path: string | null = null;
    if (file && typeof file.arrayBuffer === 'function') {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const compressed = await sharp(buffer)
        .rotate()
        .resize(1200, 630, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      const id = crypto.randomUUID();
      image_path = `${imagePrefix}${id}.jpg`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(image_path, compressed, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) {
        return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 });
      }
    }

    if (!image_path) {
      return NextResponse.json({ error: 'Banner image is required' }, { status: 400 });
    }

    const table = source === 'business' ? 'business_promotion_requests' : 'organization_promotion_requests';
    const insertPayload = source === 'business'
      ? {
          business_id: entityId,
          placement,
          audience_type,
          target_genders: audience_type === 'targeted' ? target_genders : null,
          target_age_groups: audience_type === 'targeted' ? target_age_groups : null,
          target_languages: audience_type === 'targeted' ? target_languages : null,
          target_locations: target_locations ?? null,
          target_location_coords: target_location_coords ?? null,
          image_path,
          link_type,
          link_value: link_value || null,
          description: description || null,
          tier,
          duration_days,
          price_cents: 0,
          status: 'pending_review',
        }
      : {
          organization_id: entityId,
          placement,
          audience_type,
          target_genders: audience_type === 'targeted' ? target_genders : null,
          target_age_groups: audience_type === 'targeted' ? target_age_groups : null,
          target_languages: audience_type === 'targeted' ? target_languages : null,
          target_locations: target_locations ?? null,
          target_location_coords: target_location_coords ?? null,
          image_path,
          link_type,
          link_value: link_value || null,
          description: description || null,
          tier,
          duration_days,
          price_cents: 0,
          status: 'pending_review',
        };

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from(table)
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    const reqRow = inserted as Record<string, unknown>;

    const expires_at = new Date(Date.now() + duration_days * 24 * 60 * 60 * 1000).toISOString();

    let link_url: string;
    if (source === 'business') {
      const { data: biz } = await supabaseAdmin.from('businesses').select('slug').eq('id', entityId).single();
      const slug = (biz as { slug?: string } | null)?.slug;
      if (link_type === 'business_page' && slug) {
        link_url = `/business/${slug}`;
      } else if (link_type === 'external' && link_value) {
        link_url = link_value;
      } else {
        link_url = slug ? `/business/${slug}` : (link_value || '#');
      }
    } else {
      const { data: org } = await supabaseAdmin.from('organizations').select('username').eq('id', entityId).single();
      const username = (org as { username?: string } | null)?.username;
      if (link_type === 'organization_page' && username) {
        link_url = `/organization/${username}`;
      } else if (link_type === 'external' && link_value) {
        link_url = link_value;
      } else {
        link_url = username ? `/organization/${username}` : (link_value || '#');
      }
    }

    const bannerPayload = {
      image_path,
      link_url,
      alt: description || 'Promotion',
      status: 'active' as const,
      expires_at,
      duration_days,
      audience_type: audience_type || 'universal',
      target_genders,
      target_age_groups,
      target_languages,
      target_locations,
      target_location_coords,
    };

    const { data: banner, error: insertErr } = await supabaseAdmin
      .from('feed_banners')
      .insert(bannerPayload)
      .select('id')
      .single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    await syncBannerTargetCities(banner.id, target_location_coords, tier);

    await supabaseAdmin
      .from(table)
      .update({
        status: 'approved',
        feed_banner_id: banner.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reqRow.id);

    await sendApprovalNotification('promotion', reqRow.id as string);

    return NextResponse.json({ success: true, status: 'approved', feed_banner_id: banner.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
