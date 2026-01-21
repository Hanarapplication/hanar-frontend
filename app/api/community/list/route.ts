import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { lang = 'en', tags = [], search = '', offset = 0, sortMode = 'latest' } = await req.json();
    const limit = 10;

    // Build base query
    let query = supabase
      .from('community_posts')
      .select(`
        id,
        title,
        body,
        created_at,
        author,
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

    const { data, error } = await query;

    if (error) {
      console.error('[Supabase Query Error]', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('[API Error]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
