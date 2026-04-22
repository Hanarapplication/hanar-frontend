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
  /** Prefer posts in this language (dropdown / UI), then English if none / to fill. */
  feedLang?: string | null;
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

function normalizeFeedLang(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase();
  if (!t || t === 'auto') return null;
  return t.length >= 2 ? t.slice(0, 2) : t;
}

function postHasTag(p: PostRow, tag: string): boolean {
  const want = tag.trim().toLowerCase();
  if (!want) return true;
  const tags = p.tags as string[] | null;
  if (!Array.isArray(tags)) return false;
  return tags.some((x) => String(x).toLowerCase().trim() === want);
}

function postLangCode(p: PostRow): string | null {
  const v = p.language;
  if (v == null || v === '') return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;
  // BCP-47 / common DB forms: fa-IR, en_US → compare on 2-letter primary subtag
  const primary = (s.split(/[-_]/)[0] || s).trim();
  if (!primary) return null;
  return primary.length >= 2 ? primary.slice(0, 2) : primary;
}

/** Buckets for a feed language: matching posts, English or unset, then other languages (newest first within each). */
function bucketPostsForFeedLang(posts: PostRow[], want: string): { match: PostRow[]; english: PostRow[]; other: PostRow[] } {
  if (!want || want === 'en') {
    return { match: [], english: posts, other: [] };
  }
  const byDate = (a: PostRow, b: PostRow) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

  const match = posts.filter((p) => postLangCode(p) === want).sort(byDate);
  const english = posts
    .filter((p) => {
      const c = postLangCode(p);
      return c === 'en' || c == null;
    })
    .sort(byDate);
  const other = posts
    .filter((p) => {
      const c = postLangCode(p);
      return c != null && c !== 'en' && c !== want;
    })
    .sort(byDate);
  return { match, english, other };
}

/** Prefer `want` language first; if none, English + unset language; then other languages. Newest first within each bucket. */
function orderPostsForFeedLang(posts: PostRow[], want: string): PostRow[] {
  if (!want || want === 'en') return posts;
  const { match, english, other } = bucketPostsForFeedLang(posts, want);

  const seen = new Set<string>();
  const pushUnique = (arr: PostRow[], out: PostRow[]) => {
    for (const p of arr) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        out.push(p);
      }
    }
  };
  const out: PostRow[] = [];
  if (match.length === 0) {
    pushUnique(english, out);
    pushUnique(other, out);
  } else {
    pushUnique(match, out);
    pushUnique(english, out);
    pushUnique(other, out);
  }
  return out;
}

function sortRowsByLikeCountDesc(rows: PostRow[], likeCounts: Record<string, number>): PostRow[] {
  return [...rows].sort((a, b) => (likeCounts[b.id] ?? 0) - (likeCounts[a.id] ?? 0));
}

/** Popular order that still prefers feed language, then English/null, then others. */
function pickPopularPostsRespectingFeedLang(
  posts: PostRow[],
  want: string | null,
  likeCounts: Record<string, number>,
  limit: number
): PostRow[] {
  if (!want || want === 'en') {
    return sortRowsByLikeCountDesc(posts, likeCounts).slice(0, limit);
  }
  const { match, english, other } = bucketPostsForFeedLang(posts, want);
  const ordered = [
    ...sortRowsByLikeCountDesc(match, likeCounts),
    ...sortRowsByLikeCountDesc(english, likeCounts),
    ...sortRowsByLikeCountDesc(other, likeCounts),
  ];
  const seen = new Set<string>();
  const out: PostRow[] = [];
  for (const p of ordered) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Random draw from the candidate pool, while periodically surfacing the newest posts. */
function pickExplorePosts(posts: PostRow[], limit: number): PostRow[] {
  if (posts.length === 0) return [];
  const ts = (iso: string) => new Date(iso || 0).getTime();
  const freshN = Math.min(14, Math.max(4, Math.ceil(limit * 0.22)));
  const byDate = [...posts].sort((a, b) => ts(b.created_at) - ts(a.created_at));
  const fresh = byDate.slice(0, freshN);
  const freshIds = new Set(fresh.map((p) => p.id));
  const pool = posts.filter((p) => !freshIds.has(p.id));
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

    const feedLangNorm = normalizeFeedLang(body.feedLang ?? null);
    if (feedLangNorm && feedLangNorm !== 'en') {
      posts = orderPostsForFeedLang(posts, feedLangNorm);
    }

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
        chosen = pickPopularPostsRespectingFeedLang(posts, feedLangNorm, likeCounts, limit);
      } else {
        // pickExplorePosts shuffles the pool and would undo language ordering — keep bucket order when a feed language is set.
        chosen =
          feedLangNorm && feedLangNorm !== 'en'
            ? posts.slice(0, limit)
            : pickExplorePosts(posts, limit);
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
