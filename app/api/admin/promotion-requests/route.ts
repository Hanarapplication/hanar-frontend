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

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const role = cookieStore.get('adminRole')?.value;
  return !!role && allowedRoles.includes(role);
}

function getPublicUrl(path: string): string {
  if (!path || path.startsWith('http')) return path || '';
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** GET: list promotion requests (business + organization). Only paid requests are shown—pending_payment are excluded until Stripe webhook sets pending_review after successful payment. */
export async function GET(req: Request) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    // Exclude pending_payment so admin never sees unpaid requests; they appear only after payment succeeds (webhook sets pending_review)
    let bizQuery = supabaseAdmin
      .from('business_promotion_requests')
      .select('id, business_id, placement, audience_type, target_genders, target_age_groups, target_languages, target_locations, target_location_coords, image_path, link_type, link_value, description, tier, duration_days, price_cents, status, feed_banner_id, created_at')
      .neq('status', 'pending_payment')
      .order('created_at', { ascending: false });
    if (status) bizQuery = bizQuery.eq('status', status);

    let orgQuery = supabaseAdmin
      .from('organization_promotion_requests')
      .select('id, organization_id, placement, audience_type, target_genders, target_age_groups, target_languages, target_locations, target_location_coords, image_path, link_type, link_value, description, tier, duration_days, price_cents, status, feed_banner_id, created_at')
      .neq('status', 'pending_payment')
      .order('created_at', { ascending: false });
    if (status) orgQuery = orgQuery.eq('status', status);

    const [bizRes, orgRes] = await Promise.all([bizQuery, orgQuery]);
    if (bizRes.error) return NextResponse.json({ error: bizRes.error.message }, { status: 500 });
    if (orgRes.error) return NextResponse.json({ error: orgRes.error.message }, { status: 500 });

    const bizRows = bizRes.data || [];
    const orgRows = orgRes.data || [];

    const businessIds = [...new Set(bizRows.map((r: any) => r.business_id).filter(Boolean))];
    const orgIds = [...new Set(orgRows.map((r: any) => r.organization_id).filter(Boolean))];

    let businessMap: Record<string, { business_name: string; slug: string }> = {};
    let orgMap: Record<string, { full_name: string; username: string }> = {};
    if (businessIds.length > 0) {
      const { data: bizData } = await supabaseAdmin.from('businesses').select('id, business_name, slug').in('id', businessIds);
      businessMap = (bizData || []).reduce((acc: any, b: any) => ({ ...acc, [b.id]: { business_name: b.business_name, slug: b.slug } }), {});
    }
    if (orgIds.length > 0) {
      const { data: orgData } = await supabaseAdmin.from('organizations').select('id, full_name, username').in('id', orgIds);
      orgMap = (orgData || []).reduce((acc: any, o: any) => ({ ...acc, [o.id]: { full_name: o.full_name, username: o.username } }), {});
    }

    const isTestBiz = (row: any) => {
      const name = (businessMap[row.business_id]?.business_name || '').toLowerCase();
      const desc = (row.description || '').toLowerCase();
      const link = (row.link_value || '').toLowerCase();
      return name.includes('test') || desc.includes('test') || link.includes('test');
    };
    const isTestOrg = (row: any) => {
      const name = (orgMap[row.organization_id]?.full_name || '').toLowerCase();
      const desc = (row.description || '').toLowerCase();
      const link = (row.link_value || '').toLowerCase();
      return name.includes('test') || desc.includes('test') || link.includes('test');
    };

    const bizRequests = bizRows.filter((r: any) => !isTestBiz(r)).map((row: any) => ({
      ...row,
      source: 'business' as const,
      image_url: row.image_path ? getPublicUrl(row.image_path) : null,
      business_name: businessMap[row.business_id]?.business_name ?? null,
      business_slug: businessMap[row.business_id]?.slug ?? null,
      organization_name: null,
      organization_slug: null,
    }));

    const orgRequests = orgRows.filter((r: any) => !isTestOrg(r)).map((row: any) => ({
      ...row,
      source: 'organization' as const,
      business_id: null,
      image_url: row.image_path ? getPublicUrl(row.image_path) : null,
      business_name: null,
      business_slug: null,
      organization_name: orgMap[row.organization_id]?.full_name ?? null,
      organization_slug: orgMap[row.organization_id]?.username ?? null,
    }));

    const requests = [...bizRequests, ...orgRequests]
      .filter((r: any) => r.status !== 'pending_payment')
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return NextResponse.json({ requests });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH: approve, reject, or update (edit) a promotion request. Update only when pending_review. */
export async function PATCH(req: Request) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const id = (formData.get('id') as string)?.trim();
      const action = (formData.get('action') as string)?.trim();
      if (!id || action !== 'update') {
        return NextResponse.json({ error: 'id and action=update required' }, { status: 400 });
      }
      const { data: reqRow, error: fetchErr } = await supabaseAdmin
        .from('business_promotion_requests')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchErr || !reqRow) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      if (reqRow.status !== 'pending_review') {
        return NextResponse.json({ error: 'Can only edit requests that are pending review' }, { status: 400 });
      }
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const placement = (formData.get('placement') as string)?.trim();
      const link_type = (formData.get('link_type') as string)?.trim();
      const link_value = (formData.get('link_value') as string)?.trim() || null;
      const description = (formData.get('description') as string)?.trim() || null;
      if (placement && ['home_feed', 'community', 'universal'].includes(placement)) updates.placement = placement;
      if (link_type && ['business_page', 'external'].includes(link_type)) updates.link_type = link_type;
      if (link_value !== null) updates.link_value = link_value || null;
      if (description !== null) updates.description = description;

      const imageFile = formData.get('image') as File | null;
      if (imageFile && typeof imageFile.arrayBuffer === 'function') {
        const arrayBuffer = await imageFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const compressed = await sharp(buffer)
          .rotate()
          .resize(1200, 630, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        const fileId = crypto.randomUUID();
        const newPath = `promotion-${fileId}.jpg`;
        const { error: uploadErr } = await supabaseAdmin.storage.from(BUCKET).upload(newPath, compressed, { contentType: 'image/jpeg', upsert: false });
        if (uploadErr) return NextResponse.json({ error: 'Image upload failed: ' + uploadErr.message }, { status: 500 });
        updates.image_path = newPath;
        if (reqRow.image_path) {
          try { await supabaseAdmin.storage.from(BUCKET).remove([reqRow.image_path]); } catch { /* ignore */ }
        }
      }
      const { error: updateErr } = await supabaseAdmin.from('business_promotion_requests').update(updates).eq('id', id);
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    const body = await req.json().catch(() => null);
    if (!body?.id || !body?.action) {
      return NextResponse.json({ error: 'id and action (approve|reject|update) required' }, { status: 400 });
    }
    const { id, action, source = 'business', link_url_override, placement, link_type, link_value, description } = body as {
      id: string;
      action: 'approve' | 'reject' | 'update';
      source?: 'business' | 'organization';
      link_url_override?: string;
      placement?: string;
      link_type?: string;
      link_value?: string;
      description?: string;
    };
    if (!['approve', 'reject', 'update'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (source === 'organization') {
      const { data: reqRow, error: fetchErr } = await supabaseAdmin
        .from('organization_promotion_requests')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchErr || !reqRow) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      if (reqRow.status !== 'pending_review') {
        return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
      }
      if (action === 'update') {
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (placement && ['home_feed', 'community', 'universal'].includes(placement)) updates.placement = placement;
        if (link_type && ['organization_page', 'external'].includes(link_type)) updates.link_type = link_type;
        if (link_value !== undefined) updates.link_value = link_value?.trim() || null;
        if (description !== undefined) updates.description = description?.trim() || null;
        if (Object.keys(updates).length <= 1) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
        const { error: updateErr } = await supabaseAdmin.from('organization_promotion_requests').update(updates).eq('id', id);
        if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }
      const { data: org } = await supabaseAdmin.from('organizations').select('username').eq('id', reqRow.organization_id).single();
      const username = org?.username;
      let link_url = link_url_override?.trim();
      if (!link_url) {
        if (reqRow.link_type === 'organization_page' && username) {
          link_url = `/organization/${username}`;
        } else if (reqRow.link_type === 'external' && reqRow.link_value) {
          link_url = reqRow.link_value;
        } else {
          link_url = username ? `/organization/${username}` : (reqRow.link_value || '#');
        }
      }
      const expires_at = new Date(Date.now() + reqRow.duration_days * 24 * 60 * 60 * 1000).toISOString();
      const bannerPayload = {
        image_path: reqRow.image_path,
        link_url,
        alt: reqRow.description || 'Promotion',
        expires_at,
        duration_days: reqRow.duration_days,
        audience_type: reqRow.audience_type ?? 'universal',
        target_genders: reqRow.target_genders ?? null,
        target_age_groups: reqRow.target_age_groups ?? null,
        target_languages: reqRow.target_languages ?? null,
        target_locations: reqRow.target_locations ?? null,
        target_location_coords: reqRow.target_location_coords ?? null,
      };
      if (action === 'reject') {
        const updatePayload: { status: string; updated_at: string; feed_banner_id?: string } = {
          status: 'rejected',
          updated_at: new Date().toISOString(),
        };
        if (reqRow.image_path) {
          const { data: banner, error: insertErr } = await supabaseAdmin
            .from('feed_banners')
            .insert({ ...bannerPayload, status: 'on_hold' })
            .select('id')
            .single();
          if (!insertErr && banner) updatePayload.feed_banner_id = banner.id;
        }
        await supabaseAdmin.from('organization_promotion_requests').update(updatePayload).eq('id', id);
        return NextResponse.json({ success: true, status: 'rejected' });
      }
      if (!reqRow.image_path) {
        return NextResponse.json({ error: 'Request has no image; cannot approve' }, { status: 400 });
      }
      const { data: banner, error: insertErr } = await supabaseAdmin
        .from('feed_banners')
        .insert({ ...bannerPayload, status: 'active' })
        .select('id')
        .single();
      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
      await supabaseAdmin
        .from('organization_promotion_requests')
        .update({
          status: 'approved',
          feed_banner_id: banner.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      await sendApprovalNotification('promotion', id);
      return NextResponse.json({ success: true, status: 'approved', feed_banner_id: banner.id });
    }

    const { data: reqRow, error: fetchErr } = await supabaseAdmin
      .from('business_promotion_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !reqRow) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (reqRow.status !== 'pending_review') {
      return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
    }

    if (action === 'update') {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (placement && ['home_feed', 'community', 'universal'].includes(placement)) updates.placement = placement;
      if (link_type && ['business_page', 'external'].includes(link_type)) updates.link_type = link_type;
      if (link_value !== undefined) updates.link_value = link_value?.trim() || null;
      if (description !== undefined) updates.description = description?.trim() || null;
      if (Object.keys(updates).length <= 1) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
      const { error: updateErr } = await supabaseAdmin.from('business_promotion_requests').update(updates).eq('id', id);
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === 'reject') {
      const updatePayload: { status: string; updated_at: string; feed_banner_id?: string } = {
        status: 'rejected',
        updated_at: new Date().toISOString(),
      };
      if (reqRow.image_path) {
        const { data: biz } = await supabaseAdmin.from('businesses').select('slug').eq('id', reqRow.business_id).single();
        const slug = biz?.slug;
        let link_url = link_url_override?.trim();
        if (!link_url) {
          if (reqRow.link_type === 'business_page' && slug) {
            link_url = `/business/${slug}`;
          } else if (reqRow.link_type === 'external' && reqRow.link_value) {
            link_url = reqRow.link_value;
          } else {
            link_url = slug ? `/business/${slug}` : (reqRow.link_value || '#');
          }
        }
        const expires_at = new Date(Date.now() + reqRow.duration_days * 24 * 60 * 60 * 1000).toISOString();
        const { data: banner, error: insertErr } = await supabaseAdmin
          .from('feed_banners')
          .insert({
            image_path: reqRow.image_path,
            link_url,
            alt: reqRow.description || 'Promotion',
            status: 'on_hold',
            expires_at,
            duration_days: reqRow.duration_days,
            audience_type: reqRow.audience_type ?? 'universal',
            target_genders: reqRow.target_genders ?? null,
            target_age_groups: reqRow.target_age_groups ?? null,
            target_languages: reqRow.target_languages ?? null,
            target_locations: reqRow.target_locations ?? null,
            target_location_coords: reqRow.target_location_coords ?? null,
          })
          .select('id')
          .single();
        if (!insertErr && banner) {
          updatePayload.feed_banner_id = banner.id;
        }
      }
      await supabaseAdmin.from('business_promotion_requests').update(updatePayload).eq('id', id);
      return NextResponse.json({ success: true, status: 'rejected' });
    }

    const { data: biz } = await supabaseAdmin.from('businesses').select('slug').eq('id', reqRow.business_id).single();
    const slug = biz?.slug;
    let link_url = link_url_override?.trim();
    if (!link_url) {
      if (reqRow.link_type === 'business_page' && slug) {
        link_url = `/business/${slug}`;
      } else if (reqRow.link_type === 'external' && reqRow.link_value) {
        link_url = reqRow.link_value;
      } else {
        link_url = slug ? `/business/${slug}` : (reqRow.link_value || '#');
      }
    }

    if (!reqRow.image_path) {
      return NextResponse.json({ error: 'Request has no image; cannot approve' }, { status: 400 });
    }

    const expires_at = new Date(Date.now() + reqRow.duration_days * 24 * 60 * 60 * 1000).toISOString();
    const { data: banner, error: insertErr } = await supabaseAdmin
      .from('feed_banners')
      .insert({
        image_path: reqRow.image_path,
        link_url,
        alt: reqRow.description || 'Promotion',
        status: 'active',
        expires_at,
        duration_days: reqRow.duration_days,
        audience_type: reqRow.audience_type ?? 'universal',
        target_genders: reqRow.target_genders ?? null,
        target_age_groups: reqRow.target_age_groups ?? null,
        target_languages: reqRow.target_languages ?? null,
        target_locations: reqRow.target_locations ?? null,
        target_location_coords: reqRow.target_location_coords ?? null,
      })
      .select('id')
      .single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    await supabaseAdmin
      .from('business_promotion_requests')
      .update({
        status: 'approved',
        feed_banner_id: banner.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    await sendApprovalNotification('promotion', id);

    return NextResponse.json({ success: true, status: 'approved', feed_banner_id: banner.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE: remove a promotion request (admin only). Archives linked feed banner if approved. Use ?source=organization for org requests. */
export async function DELETE(req: Request) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const source = searchParams.get('source') || 'business';
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const table = source === 'organization' ? 'organization_promotion_requests' : 'business_promotion_requests';
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from(table)
      .select('id, image_path, feed_banner_id')
      .eq('id', id)
      .single();

    if (fetchErr || !row) {
      if (source === 'business') {
        const orgRes = await supabaseAdmin
          .from('organization_promotion_requests')
          .select('id, image_path, feed_banner_id')
          .eq('id', id)
          .single();
        if (!orgRes.error && orgRes.data) {
          const r = orgRes.data;
          if (r.feed_banner_id) {
            await supabaseAdmin.from('feed_banners').update({ status: 'archived' }).eq('id', r.feed_banner_id);
          }
          await supabaseAdmin.from('organization_promotion_requests').delete().eq('id', id);
          if (r.image_path && !r.feed_banner_id) {
            try { await supabaseAdmin.storage.from(BUCKET).remove([r.image_path]); } catch { /* ignore */ }
          }
          return NextResponse.json({ success: true });
        }
      }
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (row.feed_banner_id) {
      await supabaseAdmin
        .from('feed_banners')
        .update({ status: 'archived' })
        .eq('id', row.feed_banner_id);
    }

    const { error: deleteErr } = await supabaseAdmin.from(table).delete().eq('id', id);

    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

    if (row.image_path && !row.feed_banner_id) {
      try {
        await supabaseAdmin.storage.from(BUCKET).remove([row.image_path]);
      } catch {
        // ignore storage cleanup failure
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
