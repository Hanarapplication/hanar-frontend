import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMutuallyBlockedUserIds } from '@/lib/userBlocksServer';
import { getHomeRankContext } from '@/lib/communityFeedPersonalize';
import { scoreHomePost, scoresToRank0to100 } from '@/lib/homeFeedRank';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Get preferred languages and tags from a user's own posts (for ranking). */
async function getUserPostPreferences(userId: string): Promise<{ languages: Set<string>; tags: Set<string> }> {
  const { data: userPosts } = await supabaseAdmin
    .from('community_posts')
    .select('language, tags')
    .eq('user_id', userId)
    .eq('deleted', false);
  const languages = new Set<string>();
  const tags = new Set<string>();
  (userPosts || []).forEach((p: { language?: string | null; tags?: string[] | null }) => {
    if (p.language) languages.add(String(p.language).toLowerCase());
    if (Array.isArray(p.tags)) p.tags.forEach((t: string) => tags.add(String(t).toLowerCase().trim()));
  });
  return { languages, tags };
}

/** Tokenize search into words for topic matching (ignore very short words). */
function searchTopicWords(search: string): Set<string> {
  const words = search.trim().toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
  return new Set(words);
}

/** Score a post for relevance to current language, search, and user preferences (higher = show first). */
function scorePost(
  post: { language?: string | null; tags?: string[] | null; title?: string; body?: string },
  currentLang: string,
  searchWords: Set<string>,
  userLangs: Set<string>,
  userTags: Set<string>
): number {
  let score = 0;
  const postLang = post.language ? String(post.language).toLowerCase() : '';
  const postTags = Array.isArray(post.tags)
    ? (post.tags as string[]).map((t) => String(t).toLowerCase().trim())
    : [];
  const title = (post.title || '').toLowerCase();
  const body = (post.body || '').toLowerCase();

  // Language: boost if matches current feed language or user's posting languages
  if (currentLang && postLang === currentLang.toLowerCase()) score += 3;
  if (userLangs.has(postLang)) score += 2;

  // Tags: boost per tag that matches user's tags or appears in search
  for (const tag of postTags) {
    if (userTags.has(tag)) score += 2;
    if (searchWords.has(tag)) score += 2;
  }

  // Search: boost if search words appear in title or body
  for (const word of searchWords) {
    if (title.includes(word) || body.includes(word)) score += 1;
  }

  return score;
}

const SELECT_FIELDS = `
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
  replies,
  language,
  tags,
  community_comments(count)
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyBaseFilters(query: any, search: string, tags: string[]): any {
  if (search.trim() !== '') {
    const term = `%${search.trim()}%`;
    query = query.or(`title.ilike.${term},body.ilike.${term},author.ilike.${term}`);
  }
  if (tags.length > 0) {
    query = query.or(tags.map((tag: string) => `tags.cs.{${tag}}`).join(','));
  }
  return query;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      lang = '',
      tags = [],
      search = '',
      offset: rawOffset = 0,
      sortMode = 'latest',
      userId,
      primaryLang: bodyPrimaryLang,
      spokenLanguages: bodySpokenLangs,
      deviceLang: bodyDeviceLang,
    } = body as {
      lang?: string;
      tags?: string[];
      search?: string;
      offset?: number;
      sortMode?: string;
      userId?: string;
      primaryLang?: string | null;
      spokenLanguages?: string[];
      deviceLang?: string | null;
    };
    const offset = Math.max(0, Number(rawOffset) || 0);
    const limit = 10;
    const feedLang = (lang && String(lang).toLowerCase()) || '';
    const useLangPriority = feedLang && feedLang !== 'all';

    const base = () =>
      supabaseAdmin
        .from('community_posts')
        .select(SELECT_FIELDS)
        .eq('deleted', false)
        .or('visibility.eq.community,visibility.is.null');

    let posts: unknown[] = [];
    let usedPersonalizedRanking = false;

    const usePersonalizedLatest = sortMode === 'latest' && !useLangPriority;

    if (usePersonalizedLatest) {
      usedPersonalizedRanking = true;
      // Smaller pool on early pages = faster TTFB; still grows with offset for pagination depth.
      const poolSize = Math.min(320, Math.max(52, offset + limit + 42));
      let query = applyBaseFilters(base(), String(search || ''), Array.isArray(tags) ? tags : []);
      const { data, error } = await query.order('created_at', { ascending: false }).limit(poolSize);
      if (error) throw error;
      let pool = (data || []) as Array<Record<string, unknown> & { id: string; created_at: string }>;

      const uid = typeof userId === 'string' && userId.trim() ? userId.trim() : null;
      if (uid) {
        const blocked = await getMutuallyBlockedUserIds(supabaseAdmin, uid);
        pool = pool.filter((p) => !p.user_id || !blocked.has(p.user_id as string));
      }

      const postIds = pool.map((p) => p.id);
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
      }

      const ctx = await getHomeRankContext(supabaseAdmin, {
        userId: uid,
        primaryLang: bodyPrimaryLang ?? null,
        spokenLanguages: Array.isArray(bodySpokenLangs) ? bodySpokenLangs : [],
        deviceLang: bodyDeviceLang ?? null,
      });

      const scored = pool.map((p) => {
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
      const slice = withNorm.slice(offset, offset + limit).map((row) => ({
        ...row.p,
        likes_post: row.likeCount,
        community_comments: [{ count: row.commentCount }],
        home_rank_score: row.home_rank_score,
      }));
      posts = slice;
    } else if (useLangPriority) {
      // Order: selected language first, then English, then others. If no posts in selected lang, English then others.
      const orderOpt = sortMode === 'popular' ? { ascending: false } : { ascending: false };
      const orderCol = sortMode === 'popular' ? 'likes_post' : 'created_at';
      const need = offset + limit;

      const q1 = base().eq('language', feedLang).order(orderCol, orderOpt);
      const q2 = feedLang !== 'en' ? base().eq('language', 'en').order(orderCol, orderOpt) : null;
      const q3 =
        feedLang === 'en'
          ? base().neq('language', 'en').order(orderCol, orderOpt)
          : base().not('language', 'in', `("${feedLang}","en")`).order(orderCol, orderOpt);

      const query1 = applyBaseFilters(q1, search, tags);
      const query2 = q2 ? applyBaseFilters(q2, search, tags) : null;
      const query3 = applyBaseFilters(q3, search, tags);

      const [r1, r2, r3] = await Promise.all([
        query1.range(0, need - 1),
        query2 ? query2.range(0, need - 1) : Promise.resolve({ data: [] }),
        query3.range(0, need - 1),
      ]);

      const a = (r1.data || []) as unknown[];
      const b = (feedLang === 'en' ? [] : (r2?.data || [])) as unknown[];
      const c = (r3.data || []) as unknown[];
      const merged = [...a, ...b, ...c];
      posts = merged.slice(offset, offset + limit);
    } else {
      // No language priority: single query, all languages
      let query = applyBaseFilters(base(), search, tags);
      if (sortMode === 'popular') {
        query = query.order('likes_post', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) throw error;
      posts = data || [];
    }

    type PostRow = { id: string; likes_post?: number; [k: string]: unknown };
    const postList = posts as PostRow[];
    if (postList.length === 0) return NextResponse.json([]);

    // Enrich with like counts from community_post_likes
    const postIds = postList.map((p) => p.id);
    const { data: likesData } = await supabaseAdmin
      .from('community_post_likes')
      .select('post_id')
      .in('post_id', postIds);

    const likeCounts: Record<string, number> = {};
    postIds.forEach((id: string) => (likeCounts[id] = 0));
    (likesData || []).forEach((row: { post_id: string }) => {
      likeCounts[row.post_id] = (likeCounts[row.post_id] ?? 0) + 1;
    });

    let enriched = postList.map((p) => ({
      ...p,
      likes_post: likeCounts[p.id] ?? p.likes_post ?? 0,
    }));

    // Enrich with profile pics and org logos
    const userIds = [...new Set((enriched as { user_id?: string | null }[]).map((p) => p.user_id).filter(Boolean))] as string[];
    const orgIds = [...new Set((enriched as { org_id?: string | null }[]).map((p) => p.org_id).filter(Boolean))] as string[];
    const [profilesRes, orgsRes] = await Promise.all([
      userIds.length > 0 ? supabaseAdmin.from('profiles').select('id, profile_pic_url').in('id', userIds) : Promise.resolve({ data: [] }),
      orgIds.length > 0 ? supabaseAdmin.from('organizations').select('id, logo_url').in('id', orgIds) : Promise.resolve({ data: [] }),
    ]);
    const profileMap = new Map((profilesRes.data || []).map((p: { id: string; profile_pic_url: string | null }) => [p.id, p.profile_pic_url]));
    const orgMap = new Map((orgsRes.data || []).map((o: { id: string; logo_url: string | null }) => [o.id, o.logo_url]));
    enriched.forEach((p: { user_id?: string | null; org_id?: string | null; author_type?: string | null } & Record<string, unknown>) => {
      if (p.author_type === 'organization' && p.org_id) {
        (p as Record<string, unknown>).logo_url = orgMap.get(p.org_id) ?? null;
      } else if (p.user_id) {
        (p as Record<string, unknown>).profile_pic_url = profileMap.get(p.user_id) ?? null;
      }
    });

    if (userId && typeof userId === 'string') {
      const blocked = await getMutuallyBlockedUserIds(supabaseAdmin, userId);
      enriched = enriched.filter((p) => {
        const uid = (p as { user_id?: string | null }).user_id;
        return !uid || !blocked.has(uid);
      });
    }

    // When we already applied language-priority order (selected → en → others), keep it; otherwise rank by relevance then sort
    let result: unknown[];
    if (useLangPriority || usedPersonalizedRanking) {
      result = enriched;
    } else {
      const currentLang = (feedLang && String(feedLang)) || 'en';
      const searchWords = searchTopicWords(search || '');
      let userLangs = new Set<string>();
      let userTags = new Set<string>();
      if (userId && typeof userId === 'string') {
        const prefs = await getUserPostPreferences(userId);
        userLangs = prefs.languages;
        userTags = prefs.tags;
      }
      const scored = enriched.map((p: Record<string, unknown>) => ({
        ...p,
        _relevanceScore: scorePost(
          p as { language?: string | null; tags?: string[] | null; title?: string; body?: string },
          currentLang,
          searchWords,
          userLangs,
          userTags
        ),
      }));
      scored.sort((a: { _relevanceScore: number; created_at?: string; likes_post?: number }, b: { _relevanceScore: number; created_at?: string; likes_post?: number }) => {
        if (b._relevanceScore !== a._relevanceScore) return b._relevanceScore - a._relevanceScore;
        if (sortMode === 'popular') return (b.likes_post ?? 0) - (a.likes_post ?? 0);
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
      result = scored.map(({ _relevanceScore, ...rest }) => rest);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[API Error]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
