// API for liking/unliking community posts using community_post_likes table

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUserId } from '@/lib/authApi';
import { usersAreMutuallyBlocked } from '@/lib/userBlocksServer';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { post_id } = await req.json();

    if (!post_id) {
      return NextResponse.json({ error: 'Missing post_id' }, { status: 400 });
    }

    const { data: postRow } = await supabaseAdmin
      .from('community_posts')
      .select('user_id')
      .eq('id', post_id)
      .maybeSingle();
    const authorId = (postRow as { user_id?: string } | null)?.user_id;
    if (authorId && (await usersAreMutuallyBlocked(supabaseAdmin, userId, authorId))) {
      return NextResponse.json({ error: 'Blocked' }, { status: 403 });
    }

    // Check if user already liked this post
    const { data: existing } = await supabaseAdmin
      .from('community_post_likes')
      .select('id')
      .eq('post_id', post_id)
      .eq('user_id', userId)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Already liked' }, { status: 409 });
    }

    // Insert new like
    const { error: insertError } = await supabaseAdmin
      .from('community_post_likes')
      .insert([{ post_id, user_id: userId }]);

    if (insertError) {
      console.error('Insert error:', insertError.message);
      return NextResponse.json({ error: 'Failed to like post' }, { status: 500 });
    }

    // Update like count on community_posts (direct update - no RPC needed)
    const { data: post } = await supabaseAdmin.from('community_posts').select('likes_post').eq('id', post_id).single();
    const currentCount = post?.likes_post ?? 0;
    const newCount = currentCount + 1;
    await supabaseAdmin.from('community_posts').update({ likes_post: newCount }).eq('id', post_id);

    return NextResponse.json({ success: true, likes: newCount }, { status: 200 });
  } catch (err) {
    console.error('Post like API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const post_id = searchParams.get('post_id');

    if (!post_id) {
      return NextResponse.json({ error: 'Missing post_id' }, { status: 400 });
    }

    const { data: postRow } = await supabaseAdmin
      .from('community_posts')
      .select('user_id')
      .eq('id', post_id)
      .maybeSingle();
    const authorId = (postRow as { user_id?: string } | null)?.user_id;
    if (authorId && (await usersAreMutuallyBlocked(supabaseAdmin, userId, authorId))) {
      return NextResponse.json({ error: 'Blocked' }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('community_post_likes')
      .delete()
      .eq('post_id', post_id)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Delete error:', deleteError.message);
      return NextResponse.json({ error: 'Failed to unlike post' }, { status: 500 });
    }

    // Decrement like count on community_posts
    const { data: post } = await supabaseAdmin.from('community_posts').select('likes_post').eq('id', post_id).single();
    const currentCount = post?.likes_post ?? 0;
    const newCount = Math.max(0, currentCount - 1);
    await supabaseAdmin
      .from('community_posts')
      .update({ likes_post: newCount })
      .eq('id', post_id);

    return NextResponse.json({ success: true, likes: newCount }, { status: 200 });
  } catch (err) {
    console.error('Post unlike API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
