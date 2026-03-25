import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMutuallyBlockedUserIds } from '@/lib/userBlocksServer';
import { getHomeRankContext } from '@/lib/communityFeedPersonalize';
import { scoreHomePost, scoresToRank0to100 } from '@/lib/homeFeedRank';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SELECT_HOME = `
  id,
  title,
  body,
  created_at,
  author,
  author_type,
  username,
  user_id,
  org_id,
  image,
  video,
  likes_post,
  language,
  tags,
  community_comments(count)
`;

type Body = {
  userId?: string | null;
  limit?: number;
  candidateLimit?: number;
  primaryLang?: string | null;
  spokenLanguages?: string[];
  /** e.g. navigator.language */
  deviceLang?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const limit = Math.min(24, Math.max(4, Number(body.limit) || 12));
    const candidateLimit = Math.min(200, Math.max(40, Number(body.candidateLimit) || 100));
    const userId = typeof body.userId === 'string' && body.userId.trim() ? body.userId.trim() : null;

    const ctx = await getHomeRankContext(supabaseAdmin, {
      userId,
      primaryLang: body.primaryLang ?? null,
      spokenLanguages: body.spokenLanguages,
      deviceLang: body.deviceLang ?? null,
    });

    const { data: rows, error } = await supabaseAdmin
      .from('community_posts')
      .select(SELECT_HOME)
      .eq('deleted', false)
      .or('visibility.eq.community,visibility.is.null')
      .order('created_at', { ascending: false })
      .limit(candidateLimit);

    if (error) {
      console.error('[home-feed-posts]', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    let posts = rows || [];

    if (userId) {
      const blocked = await getMutuallyBlockedUserIds(supabaseAdmin, userId);
      posts = posts.filter((p: { user_id?: string | null }) => !p.user_id || !blocked.has(p.user_id));
    }

    const postIds = posts.map((p: { id: string }) => p.id);
    const likeCounts: Record<string, number> = {};
    postIds.forEach((id) => {
      likeCounts[id] = 0;
    });

    if (postIds.length > 0) {
      const { data: likesRows } = await supabaseAdmin
        .from('community_post_likes')
        .select('post_id')
        .in('post_id', postIds);

      (likesRows || []).forEach((r: { post_id: string }) => {
        likeCounts[r.post_id] = (likeCounts[r.post_id] ?? 0) + 1;
      });

      const scored = posts.map((p: Record<string, unknown> & { id: string; created_at: string }) => {
        const commentCount =
          (p.community_comments as { count?: number }[] | undefined)?.[0]?.count ?? 0;
        const likeCount = likeCounts[p.id] ?? (p.likes_post as number) ?? 0;
        const raw = scoreHomePost(
          {
            created_at: p.created_at,
            language: p.language as string | null,
            tags: p.tags as string[] | null,
            title: p.title as string,
            body: p.body as string,
            likeCount,
            commentCount,
          },
          ctx
        );
        return { p, raw, likeCount, commentCount };
      });

      const rawScores = scored.map((x) => x.raw);
      const norm = scoresToRank0to100(rawScores);

      const withNorm = scored.map((row, i) => ({ ...row, home_rank_score: norm[i] ?? 0 }));
      withNorm.sort((a, b) => b.raw - a.raw);

      const top = withNorm.slice(0, limit).map((row) => ({
        ...row.p,
        likes_post: row.likeCount,
        community_comments: [{ count: row.commentCount }],
        home_rank_score: row.home_rank_score,
      }));

      return NextResponse.json({ posts: top });
    }

    return NextResponse.json({ posts: [] });
  } catch (err) {
    console.error('[home-feed-posts]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
