import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type PostRow = {
  id: string | number;
  body: string;
  language: string | null;
  user_id: string;
  created_at: string;
};

function normalizeLangCode(value: string | null | undefined): string | null {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'auto') return null;
  const primary = (raw.split(/[-_]/)[0] || '').trim();
  if (!/^[a-z]{2,3}$/.test(primary)) return null;
  return primary;
}

/**
 * GET /api/posts/:id?lang=en
 *
 * Translation read policy:
 * - Always return original post content for normal post loading.
 * - If a cached translation already exists for ?lang, include it.
 * - Never generate a new translation from this endpoint.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const targetLang = normalizeLangCode(request.nextUrl.searchParams.get('lang'));

    if (!id) {
      return NextResponse.json({ error: 'Post id is required' }, { status: 400 });
    }
    // 1) Fetch original post
    const { data: post, error: postError } = await supabaseAdmin
      .from('community_posts')
      .select('id, body, language, user_id, created_at')
      .eq('id', id)
      .maybeSingle<PostRow>();

    if (postError) {
      console.error('posts/:id fetch error', postError);
      return NextResponse.json({ error: 'Failed to load post' }, { status: 500 });
    }
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const sourceLang = normalizeLangCode(post.language);

    const originalText = String(post.body || '').trim();
    if (!targetLang) {
      return NextResponse.json({
        id: post.id,
        language: sourceLang,
        translated: false,
        cached: false,
        content: originalText,
      });
    }

    // 2) Read cached translation only (no generation on miss).
    const { data: cached, error: cacheReadError } = await supabaseAdmin
      .from('post_translations')
      .select('translated_text')
      .eq('post_id', post.id)
      .eq('target_language', targetLang)
      .maybeSingle<{ translated_text: string }>();

    if (cacheReadError) {
      console.error('post_translations read error', cacheReadError);
      return NextResponse.json({ error: 'Failed to read translation cache' }, { status: 500 });
    }

    const cachedText = String(cached?.translated_text || '').trim();
    const hasCachedTranslation = !!cachedText && cachedText !== originalText;

    return NextResponse.json({
      id: post.id,
      language: sourceLang,
      target_language: targetLang,
      translated: hasCachedTranslation,
      cached: hasCachedTranslation,
      content: originalText,
      translated_content: hasCachedTranslation ? cachedText : null,
    });
  } catch (error) {
    console.error('GET /api/posts/:id error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
