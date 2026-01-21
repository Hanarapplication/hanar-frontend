import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const id = formData.get('id') as string;
    const username = formData.get('username') as string;
    const file = formData.get('file') as File;

    if (!id || !username || !file) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const compressed = await sharp(buffer)
      .rotate() // 🔁 auto-fix orientation from EXIF
      .resize(512) // limit dimensions
      .jpeg({ quality: 75 }) // compress to save space
      .withMetadata({ orientation: 1 }) // strip + reset orientation
      .toBuffer();

    const filePath = `${id}/profile.jpeg`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, compressed, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError.message);
      return NextResponse.json({ success: false, error: 'Upload failed: ' + uploadError.message }, { status: 500 });
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const publicUrl = data.publicUrl;

    const { error: dbError } = await supabase
      .from('profiles')
      .upsert({ id, username, profile_pic_url: publicUrl });

    if (dbError) {
      return NextResponse.json({ success: false, error: 'Database update failed: ' + dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Unexpected server error' }, { status: 500 });
  }
}
