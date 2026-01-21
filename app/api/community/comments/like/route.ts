// this API is for liking a comment  under community posts

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { comment_id, user_id } = await req.json();

    if (!comment_id || !user_id) {
      return NextResponse.json({ error: 'Missing comment_id or user_id' }, { status: 400 });
    }

    // 1. Check if user already liked this comment
    const { data: existing } = await supabase
      .from('community_comment_likes')
      .select('id')
      .eq('comment_id', comment_id)
      .eq('user_id', user_id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Already liked' }, { status: 409 });
    }

    // 2. Insert the like
    const { error: insertError } = await supabase
      .from('community_comment_likes')
      .insert([{ comment_id, user_id }]);

    if (insertError) {
      console.error('Insert error:', insertError.message);
      return NextResponse.json({ error: 'Failed to like comment' }, { status: 500 });
    }

    // 3. Increment comment's like count
    const { error: rpcError } = await supabase.rpc('increment_comment_likes', {
      cid: comment_id,
    });

    if (rpcError) {
      console.error('RPC error:', rpcError.message);
      return NextResponse.json({ error: 'Failed to update like count' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
