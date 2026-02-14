import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import sharp from 'sharp';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = 'feed-banners';

type Source = 'business' | 'organization';

async function getAuthUserId(req: Request): Promise<string | null> {
  const supabaseAuth = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (user?.id) return user.id;
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

async function assertCanManagePromotion(userId: string, source: Source, entityId: string): Promise<boolean> {
  if (source === 'business') {
    const { data } = await supabaseAdmin.from('businesses').select('owner_id').eq('id', entityId).single();
    return data?.owner_id === userId;
  }
  const { data } = await supabaseAdmin.from('organizations').select('user_id').eq('id', entityId).single();
  return data?.user_id === userId;
}

/** GET: list promotion requests. Query: source=business|organization and business_id= or organization_id= */
export async function GET(req: Request) {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const source = (searchParams.get('source') || '').toLowerCase() as Source;
    const businessId = searchParams.get('business_id')?.trim();
    const organizationId = searchParams.get('organization_id')?.trim();

    if (source !== 'business' && source !== 'organization') {
      return NextResponse.json({ error: 'source must be business or organization' }, { status: 400 });
    }
    const entityId = source === 'business' ? businessId : organizationId;
    if (!entityId) {
      return NextResponse.json(
        { error: source === 'business' ? 'business_id required' : 'organization_id required' },
        { status: 400 }
      );
    }

    const allowed = await assertCanManagePromotion(userId, source, entityId);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const table = source === 'business' ? 'business_promotion_requests' : 'organization_promotion_requests';
    const idColumn = source === 'business' ? 'business_id' : 'organization_id';

    const { data, error } = await supabaseAdmin
      .from(table)
      .select('id, placement, audience_type, target_genders, target_age_groups, target_languages, target_locations, image_path, link_type, link_value, description, tier, duration_days, price_cents, status, created_at')
      .eq(idColumn, entityId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ requests: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST: submit promotion request (business or organization). FormData: source, business_id or organization_id, + form fields. */
export async function POST(req: Request) {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

    const allowed = await assertCanManagePromotion(userId, source, entityId);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const placement = (formData.get('placement') as string)?.trim();
    const audience_type = ((formData.get('audience_type') as string)?.trim() || 'universal') as 'universal' | 'targeted';
    const link_type = (formData.get('link_type') as string)?.trim();
    const link_value = (formData.get('link_value') as string)?.trim() || '';
    const description = (formData.get('description') as string)?.trim() || '';
    const tier = (formData.get('tier') as string)?.trim();
    const duration_days = parseInt(String(formData.get('duration_days') || '0'), 10);
    const price_cents = parseInt(String(formData.get('price_cents') || '0'), 10);
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
    if (audience_type === 'targeted') {
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
    }

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
    if (!duration_days || duration_days < 1 || price_cents < 0) {
      return NextResponse.json({ error: 'Invalid duration or price' }, { status: 400 });
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

    const table = source === 'business' ? 'business_promotion_requests' : 'organization_promotion_requests';
    const insertPayload = source === 'business'
      ? {
          business_id: entityId,
          placement,
          audience_type,
          target_genders: audience_type === 'targeted' ? target_genders : null,
          target_age_groups: audience_type === 'targeted' ? target_age_groups : null,
          target_languages: audience_type === 'targeted' ? target_languages : null,
          target_locations: audience_type === 'targeted' ? target_locations : null,
          target_location_coords: audience_type === 'targeted' ? target_location_coords : null,
          image_path,
          link_type,
          link_value: link_value || null,
          description: description || null,
          tier,
          duration_days,
          price_cents,
          status: 'pending_payment',
        }
      : {
          organization_id: entityId,
          placement,
          audience_type,
          target_genders: audience_type === 'targeted' ? target_genders : null,
          target_age_groups: audience_type === 'targeted' ? target_age_groups : null,
          target_languages: audience_type === 'targeted' ? target_languages : null,
          target_locations: audience_type === 'targeted' ? target_locations : null,
          target_location_coords: audience_type === 'targeted' ? target_location_coords : null,
          image_path,
          link_type,
          link_value: link_value || null,
          description: description || null,
          tier,
          duration_days,
          price_cents,
          status: 'pending_payment',
        };

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from(table)
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      const msg = insertError.message || '';
      if (msg.includes('status_check') && msg.includes('check constraint')) {
        return NextResponse.json({
          error: 'Database migration required: run supabase/migrations/add_pending_payment_status_promotions.sql to allow new promotion submissions.',
        }, { status: 500 });
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    return NextResponse.json({ success: true, request: inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE: remove a promotion request. Query: source, id. */
export async function DELETE(req: Request) {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const source = (searchParams.get('source') || '').toLowerCase() as Source;
    const id = searchParams.get('id')?.trim();
    if (!id || (source !== 'business' && source !== 'organization')) {
      return NextResponse.json({ error: 'source and id required' }, { status: 400 });
    }

    const table = source === 'business' ? 'business_promotion_requests' : 'organization_promotion_requests';
    const idColumn = source === 'business' ? 'business_id' : 'organization_id';

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from(table)
      .select(`id, feed_banner_id, ${idColumn}`)
      .eq('id', id)
      .single();

    if (fetchErr || !row) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    const entityId = (row as Record<string, string>)[idColumn];
    if (!entityId) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    const allowed = await assertCanManagePromotion(userId, source, entityId);
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (row.feed_banner_id) {
      await supabaseAdmin
        .from('feed_banners')
        .update({ status: 'archived' })
        .eq('id', row.feed_banner_id);
    }

    const { error: deleteErr } = await supabaseAdmin.from(table).delete().eq('id', id);
    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
