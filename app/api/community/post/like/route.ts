//This API is responsible for liking a community post

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { post_id, user_id } = await req.json();

    if (!post_id || !user_id) {
      return NextResponse.json({ error: 'Missing post_id or user_id' }, { status: 400 });
    }

    // Check if user already liked this post
    const { data: existing } = await supabase
      .from('community_post_likes')
      .select('id')
      .eq('post_id', post_id)
      .eq('user_id', user_id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Already liked' }, { status: 409 });
    }

    // Insert new like
    const { error: insertError } = await supabase
      .from('community_post_likes')
      .insert([{ post_id, user_id }]);

    if (insertError) {
      console.error('Insert error:', insertError.message);
      return NextResponse.json({ error: 'Failed to like post' }, { status: 500 });
    }

    // Increment the post's like count using RPC
    const { error: rpcError } = await supabase.rpc('increment_post_likes', {
      pid: post_id,
    });

    if (rpcError) {
      console.error('RPC error:', rpcError.message);
      return NextResponse.json({ error: 'Failed to increment likes' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Post like API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
