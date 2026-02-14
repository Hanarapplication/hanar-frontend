import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BUCKET = 'feed-banners';
const allowedRoles = ['owner', 'ceo', 'topmanager', 'manager', 'reviewer', 'business'];

/** Ensure the feed-banners bucket exists (create if missing). */
async function ensureBucket() {
  const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });
  if (error && !String(error.message).toLowerCase().includes('already exists')) {
    console.warn('Feed banners bucket create:', error.message);
  }
}

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const role = cookieStore.get('adminRole')?.value;
  return !!role && allowedRoles.includes(role);
}

function getPublicUrl(path: string): string {
  if (!path || path.startsWith('http')) return path || '';
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** Admin: list feed banners with optional status filter; auto-archive expired */
export async function GET(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status') || 'all'; // all | active | on_hold | archived

    const now = new Date().toISOString();
    await supabaseAdmin
      .from('feed_banners')
      .update({ status: 'archived' })
      .eq('status', 'active')
      .lt('expires_at', now);

    let query = supabaseAdmin
      .from('feed_banners')
      .select('id, image_path, link_url, alt, status, expires_at, starts_at, duration_days, package_id, created_at')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    const { data: bannerRows, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: packages } = await supabaseAdmin
      .from('feed_banner_packages')
      .select('id, name, duration_days, sort_order')
      .order('sort_order', { ascending: true });

    const banners = (bannerRows || []).map((row) => ({
      id: row.id,
      image_path: row.image_path,
      image: getPublicUrl(row.image_path),
      link_url: row.link_url,
      alt: row.alt || '',
      status: row.status || 'active',
      expires_at: row.expires_at,
      starts_at: row.starts_at,
      duration_days: row.duration_days,
      package_id: row.package_id,
      created_at: row.created_at,
    }));

    return NextResponse.json({ banners, packages: packages || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Admin: create banner (upload image + set link).
 * Banners added here are standalone feed banners only. They are NOT linked to
 * business_promotion_requests (promotion requests were removed); this route
 * only inserts into feed_banners.
 */
export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    const link_url = (formData.get('link_url') as string)?.trim() || '';
    const alt = (formData.get('alt') as string)?.trim() || '';
    const packageId = (formData.get('package_id') as string)?.trim() || null;
    const durationDaysRaw = formData.get('duration_days');
    let duration_days: number | null = durationDaysRaw != null ? Number(durationDaysRaw) : null;
    if (packageId && !duration_days) {
      const { data: pkg } = await supabaseAdmin.from('feed_banner_packages').select('duration_days').eq('id', packageId).single();
      if (pkg) duration_days = pkg.duration_days;
    }
    if (!duration_days || duration_days < 1) duration_days = 30;
    const expires_at = new Date(Date.now() + duration_days * 24 * 60 * 60 * 1000).toISOString();

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Missing image file' }, { status: 400 });
    }
    if (!link_url) {
      return NextResponse.json({ error: 'link_url is required' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const compressed = await sharp(buffer)
      .rotate()
      .resize(1200, 630, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const id = crypto.randomUUID();
    const filePath = `${id}.jpg`;

    await ensureBucket();

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, compressed, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('Feed banner upload error:', uploadError.message);
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 });
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('feed_banners')
      .insert({
        id,
        image_path: filePath,
        link_url,
        alt: alt || 'Banner',
        status: 'active',
        expires_at,
        duration_days,
        package_id: packageId || null,
      })
      .select('id, image_path, link_url, alt, status, expires_at, duration_days, created_at')
      .single();

    if (insertError) {
      try {
        await supabaseAdmin.storage.from(BUCKET).remove([filePath]);
      } catch {
        // ignore
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      banner: {
        id: inserted.id,
        image: getPublicUrl(inserted.image_path),
        link_url: inserted.link_url,
        alt: inserted.alt,
        status: inserted.status,
        expires_at: inserted.expires_at,
        duration_days: inserted.duration_days,
        created_at: inserted.created_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Admin: update banner (status, extend time, link_url, alt). Send FormData with optional image to replace photo. */
export async function PATCH(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const id = (formData.get('id') as string)?.trim();
      const linkUrl = (formData.get('link_url') as string)?.trim();
      const altText = (formData.get('alt') as string)?.trim();
      const imageFile = formData.get('image') as File | null;

      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('feed_banners')
        .select('id, image_path, link_url, alt')
        .eq('id', id)
        .single();
      if (fetchErr || !existing) return NextResponse.json({ error: 'Banner not found' }, { status: 404 });

      const updates: Record<string, unknown> = {};
      if (typeof linkUrl === 'string' && linkUrl) updates.link_url = linkUrl;
      if (typeof altText === 'string') updates.alt = altText;

      let newImagePath: string | null = null;
      if (imageFile && typeof imageFile.arrayBuffer === 'function') {
        const arrayBuffer = await imageFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const compressed = await sharp(buffer)
          .rotate()
          .resize(1200, 630, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        const fileId = crypto.randomUUID();
        newImagePath = `banner-${fileId}.jpg`;
        await ensureBucket();
        const { error: uploadErr } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(newImagePath, compressed, { contentType: 'image/jpeg', upsert: false });
        if (uploadErr) return NextResponse.json({ error: 'Upload failed: ' + uploadErr.message }, { status: 500 });
        updates.image_path = newImagePath;
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('feed_banners')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      if (newImagePath && existing.image_path) {
        try {
          await supabaseAdmin.storage.from(BUCKET).remove([existing.image_path]);
        } catch {
          // ignore
        }
      }
      return NextResponse.json({ success: true, banner: data });
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    const { id, status, extend_days, expires_at: newExpiresAt, link_url: linkUrl, alt: altText } = body as {
      id: string;
      status?: 'active' | 'on_hold' | 'archived';
      extend_days?: number;
      expires_at?: string;
      link_url?: string;
      alt?: string;
    };
    const updates: Record<string, unknown> = {};
    if (status && ['active', 'on_hold', 'archived'].includes(status)) {
      updates.status = status;
    }
    if (extend_days != null && extend_days > 0) {
      const { data: row } = await supabaseAdmin.from('feed_banners').select('expires_at').eq('id', id).single();
      const base = row?.expires_at ? new Date(row.expires_at) : new Date();
      updates.expires_at = new Date(base.getTime() + extend_days * 24 * 60 * 60 * 1000).toISOString();
    }
    if (newExpiresAt) {
      updates.expires_at = newExpiresAt;
    }
    if (typeof linkUrl === 'string' && linkUrl.trim()) {
      updates.link_url = linkUrl.trim();
    }
    if (typeof altText === 'string') {
      updates.alt = altText.trim();
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from('feed_banners')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, banner: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Admin: delete banner */
export async function DELETE(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const { data: row, error: fetchError } = await supabaseAdmin
      .from('feed_banners')
      .select('image_path')
      .eq('id', id)
      .single();

    if (fetchError || !row) {
      return NextResponse.json({ error: 'Banner not found' }, { status: 404 });
    }

    const { error: deleteError } = await supabaseAdmin.from('feed_banners').delete().eq('id', id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    try {
      await supabaseAdmin.storage.from(BUCKET).remove([row.image_path]);
    } catch {
      // ignore storage cleanup failure
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
