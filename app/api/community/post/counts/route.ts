// Returns like counts from community_post_likes for given post IDs

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
      return NextResponse.json({ counts: {} });
    }

    const { data, error } = await supabaseAdmin
      .from('community_post_likes')
      .select('post_id')
      .in('post_id', postIds);

    if (error) {
      console.error('Counts fetch error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch counts' }, { status: 500 });
    }

    const counts: Record<string, number> = {};
    postIds.forEach((id) => (counts[id] = 0));
    (data || []).forEach((row) => {
      counts[row.post_id] = (counts[row.post_id] ?? 0) + 1;
    });

    return NextResponse.json({ counts });
  } catch (err) {
    console.error('Counts API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
