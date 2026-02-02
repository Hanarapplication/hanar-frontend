import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    const userId = searchParams.get('userId');

    if (!orgId && !userId) {
      return NextResponse.json({ error: 'Missing orgId or userId' }, { status: 400 });
    }

    const authorFilter = orgId
      ? `org_id.eq.${orgId},and(user_id.eq.${userId},author_type.eq.organization),and(user_id.eq.${userId},author_type.is.null)`
      : `and(user_id.eq.${userId},author_type.eq.organization),and(user_id.eq.${userId},author_type.is.null)`;

    const { data: posts, error } = await supabaseAdmin
      .from('community_posts')
      .select('*')
      .eq('deleted', false)
      .or(authorFilter)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const postIds = (posts || []).map(post => post.id);
    let commentCounts: Record<string, number> = {};

    if (postIds.length > 0) {
      const { data: commentsData } = await supabaseAdmin
        .from('community_comments')
        .select('id, post_id')
        .in('post_id', postIds);

      commentCounts = (commentsData || []).reduce<Record<string, number>>((acc, comment) => {
        acc[comment.post_id] = (acc[comment.post_id] || 0) + 1;
        return acc;
      }, {});
    }

    return NextResponse.json({ posts: posts || [], commentCounts });
  } catch (err) {
    console.error('[API Error]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
