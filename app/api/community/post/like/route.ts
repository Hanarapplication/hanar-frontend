// API for liking/unliking community posts using community_post_likes table

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { post_id, user_id } = await req.json();

    if (!post_id || !user_id) {
      return NextResponse.json({ error: 'Missing post_id or user_id' }, { status: 400 });
    }

    // Check if user already liked this post
    const { data: existing } = await supabaseAdmin
      .from('community_post_likes')
      .select('id')
      .eq('post_id', post_id)
      .eq('user_id', user_id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Already liked' }, { status: 409 });
    }

    // Insert new like
    const { error: insertError } = await supabaseAdmin
      .from('community_post_likes')
      .insert([{ post_id, user_id }]);

    if (insertError) {
      console.error('Insert error:', insertError.message);
      return NextResponse.json({ error: 'Failed to like post' }, { status: 500 });
    }

    // Update like count on community_posts (direct update - no RPC needed)
    const { data: post } = await supabaseAdmin.from('community_posts').select('likes_post').eq('id', post_id).single();
    const currentCount = post?.likes_post ?? 0;
    await supabaseAdmin.from('community_posts').update({ likes_post: currentCount + 1 }).eq('id', post_id);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Post like API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const post_id = searchParams.get('post_id');
    const user_id = searchParams.get('user_id');

    if (!post_id || !user_id) {
      return NextResponse.json({ error: 'Missing post_id or user_id' }, { status: 400 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('community_post_likes')
      .delete()
      .eq('post_id', post_id)
      .eq('user_id', user_id);

    if (deleteError) {
      console.error('Delete error:', deleteError.message);
      return NextResponse.json({ error: 'Failed to unlike post' }, { status: 500 });
    }

    // Decrement like count on community_posts
    const { data: post } = await supabaseAdmin.from('community_posts').select('likes_post').eq('id', post_id).single();
    const currentCount = post?.likes_post ?? 0;
    await supabaseAdmin
      .from('community_posts')
      .update({ likes_post: Math.max(0, currentCount - 1) })
      .eq('id', post_id);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Post unlike API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
