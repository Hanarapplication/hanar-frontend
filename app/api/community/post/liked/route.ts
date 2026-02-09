// API to fetch post IDs the current user has liked (from community_post_likes)

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('community_post_likes')
      .select('post_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Liked posts fetch error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch liked posts' }, { status: 500 });
    }

    const likedPostIds = (data || []).map((row) => row.post_id);
    return NextResponse.json({ likedPostIds });
  } catch (err) {
    console.error('Liked posts API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
