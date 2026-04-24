import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { translatePost } from '@/services/translatePost';

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
 * Translation cache policy:
 * - Check post_translations first
 * - If missing (or suspicious stale original), translate once, cache, then return
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
    if (!targetLang) {
      return NextResponse.json({ error: 'Query parameter "lang" is required' }, { status: 400 });
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

    // 2) Try translation cache first
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
    const originalText = String(post.body || '').trim();
    const sourceEqualsTarget = !!sourceLang && sourceLang === targetLang;
    const suspiciousCachedOriginal =
      !!cachedText &&
      !!targetLang &&
      (sourceEqualsTarget || !!sourceLang) &&
      cachedText === originalText;

    if (cachedText && !suspiciousCachedOriginal) {
      return NextResponse.json({
        id: post.id,
        language: sourceLang,
        target_language: targetLang,
        translated: true,
        cached: true,
        content: cachedText,
      });
    }

    // 3) Cache miss: translate server-side with Google Cloud
    let translatedText = '';
    try {
      // If stored source matches target, it may be wrong metadata; allow auto-detect instead.
      const effectiveSourceLang = sourceEqualsTarget ? null : sourceLang;
      translatedText = await translatePost(post.body, effectiveSourceLang, targetLang);
    } catch (translateError) {
      console.error('Google translate error', translateError);
      return NextResponse.json({
        id: post.id,
        language: sourceLang,
        target_language: targetLang,
        translated: false,
        cached: false,
        fallback: 'original',
        content: post.body,
      });
    }

    // 4) Store translation once (unique constraint prevents duplicates)
    const { error: insertError } = await supabaseAdmin.from('post_translations').insert({
      post_id: post.id,
      target_language: targetLang,
      translated_text: translatedText,
    });

    if (insertError) {
      // Concurrent request may insert first (unique violation).
      if (insertError.code === '23505') {
        const { data: existing } = await supabaseAdmin
          .from('post_translations')
          .select('translated_text')
          .eq('post_id', post.id)
          .eq('target_language', targetLang)
          .maybeSingle<{ translated_text: string }>();

        return NextResponse.json({
          id: post.id,
          language: sourceLang,
          target_language: targetLang,
          translated: true,
          cached: true,
          content: existing?.translated_text || translatedText,
        });
      }

      console.error('post_translations insert error', insertError);
      return NextResponse.json({ error: 'Failed to save translation cache' }, { status: 500 });
    }

    return NextResponse.json({
      id: post.id,
      language: sourceLang,
      target_language: targetLang,
      translated: true,
      cached: false,
      content: translatedText,
    });
  } catch (error) {
    console.error('GET /api/posts/:id error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
