import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

export async function POST(req: Request) {
  try {
    const { lang = 'en', tags = [], search = '', offset = 0, sortMode = 'latest', userId } = await req.json();
    const limit = 10;

    // Build base query – include language and tags for ranking
    let query = supabaseAdmin
      .from('community_posts')
      .select(`
        id,
        title,
        body,
        created_at,
        author,
        author_type,
        username,
        user_id,
        image,
        likes_post,
        replies,
        language,
        tags,
        community_comments(count)
      `)
      .eq('deleted', false)
      .range(offset, offset + limit - 1);

    // Filter by language
    if (lang) {
      query = query.in('language', [lang, 'en']);
    }

    // Accurate search using ilike and OR
    if (search.trim() !== '') {
      const term = `%${search.trim()}%`;
      query = query.or(`title.ilike.${term},body.ilike.${term},author.ilike.${term}`);
    }

    // Filter by tags
    if (tags.length > 0) {
      query = query.or(tags.map((tag: string) => `tags.cs.{${tag}}`).join(','));
    }

    // Sorting
    if (sortMode === 'popular') {
      query = query.order('likes_post', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data: posts, error } = await query;

    if (error) {
      console.error('[Supabase Query Error]', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const postList = posts || [];
    if (postList.length === 0) return NextResponse.json([]);

    // Enrich with like counts from community_post_likes
    const postIds = postList.map((p: { id: string }) => p.id);
    const { data: likesData } = await supabaseAdmin
      .from('community_post_likes')
      .select('post_id')
      .in('post_id', postIds);

    const likeCounts: Record<string, number> = {};
    postIds.forEach((id: string) => (likeCounts[id] = 0));
    (likesData || []).forEach((row: { post_id: string }) => {
      likeCounts[row.post_id] = (likeCounts[row.post_id] ?? 0) + 1;
    });

    const enriched = postList.map((p: { id: string; likes_post?: number }) => ({
      ...p,
      likes_post: likeCounts[p.id] ?? p.likes_post ?? 0,
    }));

    // Algorithm: rank by relevance (language + topic) then by sort mode
    const currentLang = (lang && String(lang)) || 'en';
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

    // Sort: higher relevance first, then by date or popularity
    scored.sort((a: { _relevanceScore: number; created_at?: string; likes_post?: number }, b: { _relevanceScore: number; created_at?: string; likes_post?: number }) => {
      if (b._relevanceScore !== a._relevanceScore) return b._relevanceScore - a._relevanceScore;
      if (sortMode === 'popular') return (b.likes_post ?? 0) - (a.likes_post ?? 0);
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    // Remove internal score from response
    const result = scored.map(({ _relevanceScore, ...rest }) => rest);

    return NextResponse.json(result);
  } catch (err) {
    console.error('[API Error]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
