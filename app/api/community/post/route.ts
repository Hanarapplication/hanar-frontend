//This API route is responsible for creating a new community post

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { title, body, tags, lang, image, video, author, user_id, org_id, author_type, username, visibility } = await req.json();

    // ✅ Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length < 3 || title.length > 100) {
      return NextResponse.json({ error: 'Title must be 3–100 characters' }, { status: 400 });
    }

    if (!body || typeof body !== 'string' || body.trim().length < 5 || body.length > 300) {
      return NextResponse.json({ error: 'Body must be 5–300 characters' }, { status: 400 });
    }

    if (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string' || tag.length > 20)) {
      return NextResponse.json({ error: 'Tags must be an array of strings (max 20 chars each)' }, { status: 400 });
    }

    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid user ID' }, { status: 400 });
    }

    const { data: businessAccount } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('owner_id', user_id)
      .maybeSingle();

    if (businessAccount || author_type === 'business') {
      return NextResponse.json({ error: 'Business accounts cannot post to community' }, { status: 403 });
    }

    const visibilityValue = visibility === 'profile' ? 'profile' : 'community';

    // ✅ Insert into Supabase
    const { error } = await supabaseAdmin.from('community_posts').insert([
      {
        title: title.trim(),
        body: body.trim(),
        tags,
        image: image || null,
        video: video || null,
        language: lang || 'en',
        author: author || 'Anonymous',
        user_id,
        org_id: org_id || null,
        author_type: author_type || null,
        username: username || null,
        likes_post: 0,
        visibility: visibilityValue,
      },
    ]);
    

    if (error) {
      console.error('[Supabase Insert Error]', error.message);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API Error]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
