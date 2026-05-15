// Returns like counts from community_post_likes for given post IDs,
// and active (non-deleted) comment counts per post.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActiveCommentCountsByPostId, getLikeCountsByPostId } from '@/lib/communityActiveCommentCounts';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const postIdsParam = searchParams.get('postIds');
    if (!postIdsParam) {
      return NextResponse.json({ error: 'Missing postIds' }, { status: 400 });
    }
    const postIds = postIdsParam.split(',').filter(Boolean);
    if (postIds.length === 0) {
      return NextResponse.json({ counts: {}, commentCounts: {} });
    }

    const [counts, commentCounts] = await Promise.all([
      getLikeCountsByPostId(supabaseAdmin, postIds),
      getActiveCommentCountsByPostId(supabaseAdmin, postIds),
    ]);

    return NextResponse.json({ counts, commentCounts });
  } catch (err) {
    console.error('Counts API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
