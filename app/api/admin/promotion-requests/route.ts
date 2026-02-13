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
const allowedRoles = ['owner', 'ceo', 'topmanager', 'manager', 'reviewer'];

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const role = cookieStore.get('adminRole')?.value;
  return !!role && allowedRoles.includes(role);
}

function getPublicUrl(path: string): string {
  if (!path || path.startsWith('http')) return path || '';
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** GET: list promotion requests (optional status filter) */
export async function GET(req: Request) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = supabaseAdmin
      .from('business_promotion_requests')
      .select('id, business_id, placement, audience_type, target_genders, target_age_groups, target_languages, target_locations, image_path, link_type, link_value, description, tier, duration_days, price_cents, status, feed_banner_id, created_at')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = data || [];
    const businessIds = [...new Set(rows.map((r: any) => r.business_id).filter(Boolean))];
    let businessMap: Record<string, { business_name: string; slug: string }> = {};
    if (businessIds.length > 0) {
      const { data: bizData } = await supabaseAdmin.from('businesses').select('id, business_name, slug').in('id', businessIds);
      businessMap = (bizData || []).reduce((acc: any, b: any) => ({ ...acc, [b.id]: { business_name: b.business_name, slug: b.slug } }), {});
    }

    const requests = rows.map((row: any) => ({
      ...row,
      image_url: row.image_path ? getPublicUrl(row.image_path) : null,
      business_name: businessMap[row.business_id]?.business_name ?? null,
      business_slug: businessMap[row.business_id]?.slug ?? null,
    }));
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
    const { id, action, link_url_override, placement, link_type, link_value, description } = body as {
      id: string;
      action: 'approve' | 'reject' | 'update';
      link_url_override?: string;
      placement?: string;
      link_type?: string;
      link_value?: string;
      description?: string;
    };
    if (!['approve', 'reject', 'update'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
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

/** DELETE: remove a promotion request (admin only). Archives linked feed banner if approved. */
export async function DELETE(req: Request) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from('business_promotion_requests')
      .select('id, image_path, feed_banner_id')
      .eq('id', id)
      .single();

    if (fetchErr || !row) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    if (row.feed_banner_id) {
      await supabaseAdmin
        .from('feed_banners')
        .update({ status: 'archived' })
        .eq('id', row.feed_banner_id);
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('business_promotion_requests')
      .delete()
      .eq('id', id);

    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

    // Only remove image from storage if no feed banner uses it (approved/rejected may have created a banner with same image)
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
