import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMutuallyBlockedUserIds } from '@/lib/userBlocksServer';
import { getHomeRankContext } from '@/lib/communityFeedPersonalize';
import { scoreHomePost, scoresToRank0to100 } from '@/lib/homeFeedRank';
import {
  postMatchesFeedLangs,
  primaryPostLangCode,
  resolveFeedLangsFromHomeBody,
} from '@/lib/communityPostFeedLangs';
import { patchPostsWithActiveCommentCounts } from '@/lib/communityActiveCommentCounts';

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
  /** @deprecated Prefer `feedLangs`; single code for older clients. */
  feedLang?: string | null;
  /** Selected UI languages (2-letter codes); empty = all languages. */
  feedLangs?: string[];
  /** Home tabs: discovery mix vs strictly by likes. */
  feedSort?: 'for_you' | 'popular';
  /** If set (e.g. `news`), only posts whose tags include this token (case-insensitive). */
  tag?: string | null;
  /** Random-ish order with some newest posts mixed in (home feed). */
  explore?: boolean;
};

type PostRow = Record<string, unknown> & { id: string; created_at: string };

async function enrichPostAvatars(posts: PostRow[]): Promise<PostRow[]> {
  if (posts.length === 0) return posts;
  const userIds = Array.from(new Set(posts.map((p) => p.user_id).filter(Boolean) as string[]));
  const orgIds = Array.from(new Set(posts.map((p) => p.org_id).filter(Boolean) as string[]));
  const businessSlugs = Array.from(
    new Set(
      posts
        .map((p) => (typeof p.username === 'string' ? p.username.trim() : ''))
        .filter((v) => v.length > 0)
    )
  );

  const [{ data: profiles }, { data: organizationsByOrgId }, { data: organizationsByUserId }, { data: businesses }, { data: businessesBySlug }] = await Promise.all([
    userIds.length > 0 ? supabaseAdmin.from('profiles').select('id, profile_pic_url').in('id', userIds) : Promise.resolve({ data: [] }),
    orgIds.length > 0 ? supabaseAdmin.from('organizations').select('id, logo_url').in('id', orgIds) : Promise.resolve({ data: [] }),
    userIds.length > 0 ? supabaseAdmin.from('organizations').select('user_id, logo_url').in('user_id', userIds) : Promise.resolve({ data: [] }),
    userIds.length > 0
      ? supabaseAdmin
          .from('businesses')
          .select('owner_id, logo_url, created_at')
          .in('owner_id', userIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    businessSlugs.length > 0
      ? supabaseAdmin
          .from('businesses')
          .select('slug, logo_url')
          .in('slug', businessSlugs)
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = new Map((profiles || []).map((p: { id: string; profile_pic_url: string | null }) => [p.id, p.profile_pic_url]));
  const orgIdMap = new Map((organizationsByOrgId || []).map((o: { id: string; logo_url: string | null }) => [o.id, o.logo_url]));
  const orgUserMap = new Map((organizationsByUserId || []).map((o: { user_id: string; logo_url: string | null }) => [o.user_id, o.logo_url]));
  const businessMap = new Map<string, string | null>();
  for (const row of (businesses || []) as Array<{ owner_id: string; logo_url: string | null }>) {
    if (!businessMap.has(row.owner_id)) businessMap.set(row.owner_id, row.logo_url ?? null);
  }
  const businessSlugMap = new Map((businessesBySlug || []).map((b: { slug: string; logo_url: string | null }) => [b.slug, b.logo_url]));

  return posts.map((p) => {
    const authorType = String(p.author_type || '').toLowerCase();
    const userId = (p.user_id as string | null) || null;
    const orgId = (p.org_id as string | null) || null;
    const username = typeof p.username === 'string' ? p.username.trim() : '';
    const profilePic = userId ? profileMap.get(userId) ?? null : null;
    const orgLogo = orgId ? orgIdMap.get(orgId) ?? null : userId ? orgUserMap.get(userId) ?? null : null;
    const businessLogo = userId ? businessMap.get(userId) ?? null : null;
    const businessLogoBySlug = username ? businessSlugMap.get(username) ?? null : null;

    if (authorType === 'organization') {
      return { ...p, logo_url: orgLogo ?? null, profile_pic_url: profilePic ?? null };
    }
    if (authorType === 'business') {
      return { ...p, logo_url: businessLogo ?? businessLogoBySlug ?? orgLogo ?? null, profile_pic_url: profilePic ?? null };
    }
    // Legacy rows may not have author_type='business' but still use business slug as username.
    if (businessLogoBySlug) {
      return { ...p, logo_url: businessLogoBySlug, profile_pic_url: profilePic ?? null };
    }
    return { ...p, profile_pic_url: profilePic ?? orgLogo ?? businessLogo ?? null };
  });
}

function postHasTag(p: PostRow, tag: string): boolean {
  const want = tag.trim().toLowerCase();
  if (!want) return true;
  const tags = p.tags as string[] | null;
  if (!Array.isArray(tags)) return false;
  return tags.some((x) => String(x).toLowerCase().trim() === want);
}

/** English + unknown-language posts first (newest within each group), then other locales. Used when no feed language is chosen. */
function orderPostsEnglishFirst(posts: PostRow[]): PostRow[] {
  const byDate = (a: PostRow, b: PostRow) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  const english = posts
    .filter((p) => {
      const c = primaryPostLangCode(p);
      return c === 'en' || c == null;
    })
    .sort(byDate);
  const other = posts
    .filter((p) => {
      const c = primaryPostLangCode(p);
      return c != null && c !== 'en';
    })
    .sort(byDate);
  return [...english, ...other];
}

/** Newest first within each selected language bucket, in UI selection order (`en` bucket includes unknown language). */
function orderPostsForFeedLangsMulti(posts: PostRow[], langs: string[]): PostRow[] {
  const byDate = (a: PostRow, b: PostRow) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  const seen = new Set<string>();
  const out: PostRow[] = [];
  for (const lang of langs) {
    const bucket = posts
      .filter((p) => {
        const c = primaryPostLangCode(p);
        if (lang === 'en') return c === 'en' || c == null;
        return c === lang;
      })
      .sort(byDate);
    for (const p of bucket) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        out.push(p);
      }
    }
  }
  return out;
}

function sortRowsByLikeCountDesc(rows: PostRow[], likeCounts: Record<string, number>): PostRow[] {
  return [...rows].sort((a, b) => (likeCounts[b.id] ?? 0) - (likeCounts[a.id] ?? 0));
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Random draw from the candidate pool, while periodically surfacing the newest posts. */
/**
 * Same spirit as the old global explore shuffle, but the "fresh" slice is taken from the **start** of `prioritized`
 * (e.g. already English-first) so new/shuffled slots do not bury English posts when no feed language is set.
 */
function pickExplorePostsFromPrioritized(prioritized: PostRow[], limit: number): PostRow[] {
  if (prioritized.length === 0) return [];
  const freshN = Math.min(14, Math.max(4, Math.ceil(limit * 0.22)));
  const fresh = prioritized.slice(0, freshN);
  const freshIds = new Set(fresh.map((p) => p.id));
  const pool = prioritized.filter((p) => !freshIds.has(p.id));
  shuffleInPlace(pool);
  const take = pool.slice(0, Math.max(0, limit - fresh.length));
  const merged: PostRow[] = [];
  let pi = 0;
  let fi = 0;
  while (merged.length < limit && (pi < take.length || fi < fresh.length)) {
    if (Math.random() < 0.32 && fi < fresh.length) {
      merged.push(fresh[fi++]);
    } else if (pi < take.length) {
      merged.push(take[pi++]);
    } else if (fi < fresh.length) {
      merged.push(fresh[fi++]);
    }
  }
  return merged.slice(0, limit);
}

/**
 * No feed language chosen ("All languages"): keep the top of the feed in strict English-first
 * order, then apply the explore mix below so variety does not push non-English above English.
 */
function pickExplorePostsWithEnglishHead(prioritized: PostRow[], limit: number): PostRow[] {
  if (prioritized.length === 0) return [];
  const headN = Math.min(limit, Math.max(6, Math.ceil(limit * 0.2)), prioritized.length);
  const head = prioritized.slice(0, headN);
  const headIds = new Set(head.map((p) => p.id));
  const rest = prioritized.filter((p) => !headIds.has(p.id));
  const tailLimit = limit - head.length;
  if (tailLimit <= 0 || rest.length === 0) return head.slice(0, limit);
  const tail = pickExplorePostsFromPrioritized(rest, tailLimit);
  return [...head, ...tail].slice(0, limit);
}

function pickPopularEnglishFirst(
  posts: PostRow[],
  likeCounts: Record<string, number>,
  limit: number
): PostRow[] {
  const eng = posts.filter((p) => {
    const c = primaryPostLangCode(p);
    return c === 'en' || c == null;
  });
  const oth = posts.filter((p) => {
    const c = primaryPostLangCode(p);
    return c != null && c !== 'en';
  });
  const ordered = [
    ...sortRowsByLikeCountDesc(eng, likeCounts),
    ...sortRowsByLikeCountDesc(oth, likeCounts),
  ];
  return ordered.slice(0, limit);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const explore = Boolean(body.explore);
    const limit = explore
      ? Math.min(80, Math.max(12, Number(body.limit) || 48))
      : Math.min(24, Math.max(4, Number(body.limit) || 12));
    const candidateLimit = explore
      ? Math.min(500, Math.max(80, Number(body.candidateLimit) || 320))
      : Math.min(200, Math.max(40, Number(body.candidateLimit) || 100));
    const userId = typeof body.userId === 'string' && body.userId.trim() ? body.userId.trim() : null;

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

    let posts: PostRow[] = (rows || []) as PostRow[];

    if (userId) {
      const blocked = await getMutuallyBlockedUserIds(supabaseAdmin, userId);
      posts = posts.filter((p) => !p.user_id || !blocked.has(p.user_id as string));
    }

    const tagNorm =
      typeof body.tag === 'string' && body.tag.trim() ? body.tag.trim().toLowerCase() : '';
    if (tagNorm) {
      posts = posts.filter((p) => postHasTag(p, tagNorm));
    }

    if (posts.length === 0) {
      return NextResponse.json({ posts: [] });
    }

    const feedLangs = resolveFeedLangsFromHomeBody(body);
    const hasLangFilter = feedLangs.length > 0;
    if (hasLangFilter) {
      posts = posts.filter((p) => postMatchesFeedLangs(p, feedLangs));
    }
    if (posts.length === 0) {
      return NextResponse.json({ posts: [] });
    }

    if (!hasLangFilter) {
      posts = orderPostsEnglishFirst(posts);
    } else {
      posts = orderPostsForFeedLangsMulti(posts, feedLangs);
    }

    posts = await patchPostsWithActiveCommentCounts(supabaseAdmin, posts);

    const feedSort: 'for_you' | 'popular' = body.feedSort === 'popular' ? 'popular' : 'for_you';

    if (explore) {
      let chosen: PostRow[];
      const likeCounts: Record<string, number> = {};

      if (feedSort === 'popular') {
        const poolIds = posts.map((p) => p.id);
        poolIds.forEach((id) => {
          likeCounts[id] = 0;
        });
        if (poolIds.length > 0) {
          const { data: likesRows } = await supabaseAdmin
            .from('community_post_likes')
            .select('post_id')
            .in('post_id', poolIds);
          (likesRows || []).forEach((r: { post_id: string }) => {
            likeCounts[r.post_id] = (likeCounts[r.post_id] ?? 0) + 1;
          });
        }
        chosen = !hasLangFilter
          ? pickPopularEnglishFirst(posts, likeCounts, limit)
          : sortRowsByLikeCountDesc(posts, likeCounts).slice(0, limit);
      } else {
        chosen = !hasLangFilter ? pickExplorePostsWithEnglishHead(posts, limit) : posts.slice(0, limit);
        const exploreIds = chosen.map((p) => p.id);
        exploreIds.forEach((id) => {
          likeCounts[id] = 0;
        });
        if (exploreIds.length > 0) {
          const { data: likesRows } = await supabaseAdmin
            .from('community_post_likes')
            .select('post_id')
            .in('post_id', exploreIds);
          (likesRows || []).forEach((r: { post_id: string }) => {
            likeCounts[r.post_id] = (likeCounts[r.post_id] ?? 0) + 1;
          });
        }
      }

      const top = chosen.map((p) => {
        const commentCount =
          (p.community_comments as { count?: number }[] | undefined)?.[0]?.count ?? 0;
        return {
          ...p,
          likes_post: likeCounts[p.id] ?? (p.likes_post as number) ?? 0,
          community_comments: [{ count: commentCount }],
        };
      });
      const enrichedTop = await enrichPostAvatars(top);
      return NextResponse.json({ posts: enrichedTop });
    }

    const ctx = await getHomeRankContext(supabaseAdmin, {
      userId,
      primaryLang: body.primaryLang ?? null,
      spokenLanguages: body.spokenLanguages,
      deviceLang: body.deviceLang ?? null,
    });

    const postIds = posts.map((p) => p.id);
    const likeCounts: Record<string, number> = {};
    postIds.forEach((id) => {
      likeCounts[id] = 0;
    });

    const { data: likesRows } = await supabaseAdmin
      .from('community_post_likes')
      .select('post_id')
      .in('post_id', postIds);

    (likesRows || []).forEach((r: { post_id: string }) => {
      likeCounts[r.post_id] = (likeCounts[r.post_id] ?? 0) + 1;
    });

    const scored = posts.map((p) => {
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
    const enrichedTop = await enrichPostAvatars(top);
    return NextResponse.json({ posts: enrichedTop });
  } catch (err) {
    console.error('[home-feed-posts]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
