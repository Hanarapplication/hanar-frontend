import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { lang = 'en', tags = [], search = '', offset = 0, sortMode = 'latest' } = await req.json();
    const limit = 10;

    // Build base query
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

    // Re-sort by enriched likes when popular (DB likes_post may be 0)
    if (sortMode === 'popular') {
      enriched.sort((a: { likes_post?: number }, b: { likes_post?: number }) => (b.likes_post ?? 0) - (a.likes_post ?? 0));
    }

    return NextResponse.json(enriched);
  } catch (err) {
    console.error('[API Error]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
