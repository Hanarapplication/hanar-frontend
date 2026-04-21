import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { usersAreMutuallyBlocked } from '@/lib/userBlocksServer';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function enrichPostsWithCommentAndLikeCounts(
  posts: Array<{ id: string; likes_post?: number | null }>
) {
  const postIds = posts.map((post) => post.id);
  let commentCounts: Record<string, number> = {};
  let likeCounts: Record<string, number> = {};

  if (postIds.length > 0) {
    const [commentsRes, likesRes] = await Promise.all([
      supabaseAdmin.from('community_comments').select('id, post_id').in('post_id', postIds),
      supabaseAdmin.from('community_post_likes').select('post_id').in('post_id', postIds),
    ]);

    commentCounts = (commentsRes.data || []).reduce<Record<string, number>>((acc, comment) => {
      acc[comment.post_id] = (acc[comment.post_id] || 0) + 1;
      return acc;
    }, {});

    (likesRes.data || []).forEach((row) => {
      likeCounts[row.post_id] = (likeCounts[row.post_id] ?? 0) + 1;
    });
  }

  const enrichedPosts = posts.map((post) => ({
    ...post,
    likes_post: likeCounts[post.id] ?? post.likes_post ?? 0,
  }));

  return { enrichedPosts, commentCounts };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const businessSlugRaw = searchParams.get('businessSlug');
    const viewerUserId = searchParams.get('viewerUserId');

    /** Public community posts authored as this business (username = business slug). */
    if (businessSlugRaw) {
      const businessSlug = businessSlugRaw.trim();
      if (!businessSlug) {
        return NextResponse.json({ error: 'Invalid businessSlug' }, { status: 400 });
      }

      const { data: bizRow } = await supabaseAdmin
        .from('businesses')
        .select('owner_id')
        .eq('slug', businessSlug)
        .maybeSingle();
      const ownerId = (bizRow as { owner_id?: string | null } | null)?.owner_id ?? null;

      if (viewerUserId && ownerId && viewerUserId !== ownerId) {
        if (await usersAreMutuallyBlocked(supabaseAdmin, viewerUserId, ownerId)) {
          return NextResponse.json({ posts: [], commentCounts: {} });
        }
      }

      const { data: rawPosts, error } = await supabaseAdmin
        .from('community_posts')
        .select('*')
        .eq('deleted', false)
        .eq('author_type', 'business')
        .eq('username', businessSlug)
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      const posts = (rawPosts || []).filter((p: { visibility?: string | null }) => {
        const v = p.visibility;
        return !v || v === 'community';
      });

      const { enrichedPosts, commentCounts } = await enrichPostsWithCommentAndLikeCounts(posts);
      return NextResponse.json({ posts: enrichedPosts, commentCounts });
    }

    const orgId = searchParams.get('orgId');
    const userId = searchParams.get('userId');

    if (!orgId && !userId) {
      return NextResponse.json({ error: 'Missing orgId or userId' }, { status: 400 });
    }

    if (viewerUserId && userId && viewerUserId !== userId) {
      if (await usersAreMutuallyBlocked(supabaseAdmin, viewerUserId, userId)) {
        return NextResponse.json({ posts: [], commentCounts: {} });
      }
    }

    const individualOnly = searchParams.get('individualOnly') === 'true';
    const authorFilter = individualOnly
      ? `and(user_id.eq.${userId},author_type.is.null)`
      : orgId
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

    const { enrichedPosts, commentCounts } = await enrichPostsWithCommentAndLikeCounts(posts || []);

    return NextResponse.json({ posts: enrichedPosts, commentCounts });
  } catch (err) {
    console.error('[API Error]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
