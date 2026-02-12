import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import sharp from 'sharp';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const BUCKET = 'profile-media';

function getPublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!base || path.startsWith('http')) return path || '';
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** GET: list profile media for a user (public, for profile page) */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    if (!userId) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from('user_profile_media')
      .select('id, file_path, media_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const items = (data || []).map((row) => ({
      id: row.id,
      url: getPublicUrl(row.file_path),
      media_type: row.media_type,
      created_at: row.created_at,
    }));
    return NextResponse.json({ media: items });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/** POST: upload a profile photo or video (auth required, own profile only) */
export async function POST(req: Request) {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const mediaType = (formData.get('media_type') as string)?.toLowerCase() || 'image';

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'File required' }, { status: 400 });
    }
    if (mediaType !== 'image' && mediaType !== 'video') {
      return NextResponse.json({ error: 'media_type must be image or video' }, { status: 400 });
    }

    const filePath = `${user.id}/${crypto.randomUUID()}.${mediaType === 'video' ? 'mp4' : 'jpg'}`;
    let buffer: Buffer;
    let contentType: string;

    if (mediaType === 'image') {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      const compressed = await sharp(buffer)
        .rotate()
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      contentType = 'image/jpeg';
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(filePath, compressed, { contentType, upsert: false });
      if (uploadError) return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 });
    } else {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      contentType = file.type || 'video/mp4';
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(filePath, buffer, { contentType, upsert: false });
      if (uploadError) return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 });
    }

    const { data: row, error: insertError } = await supabaseAdmin
      .from('user_profile_media')
      .insert({ user_id: user.id, file_path: filePath, media_type: mediaType })
      .select('id, file_path, media_type, created_at')
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    return NextResponse.json({
      id: row.id,
      url: getPublicUrl(row.file_path),
      media_type: row.media_type,
      created_at: row.created_at,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/** DELETE: remove a profile media item (auth required, owner only) */
export async function DELETE(req: Request) {
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data: row, error: fetchError } = await supabaseAdmin
      .from('user_profile_media')
      .select('id, user_id, file_path')
      .eq('id', id)
      .single();

    if (fetchError || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (row.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await supabaseAdmin.storage.from(BUCKET).remove([row.file_path]);
    const { error: deleteError } = await supabaseAdmin.from('user_profile_media').delete().eq('id', id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
