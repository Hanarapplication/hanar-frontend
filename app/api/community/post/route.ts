//This API route is responsible for creating a new community post

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supportedLanguages } from '@/utils/languages';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const validLanguageCodes = new Set(
  supportedLanguages.map((l) => l.code).filter((code) => code && code !== 'auto')
);

function normalizeLangCandidate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const primary = (raw.trim().toLowerCase().split(/[-_]/)[0] || '').trim();
  if (!primary || primary === 'auto') return null;
  return validLanguageCodes.has(primary) ? primary : null;
}

function detectLanguageFromText(text: string, fallback: string): string {
  const sample = String(text || '').trim();
  if (!sample) return fallback;

  const count = (re: RegExp) => (sample.match(re) || []).length;
  const counts = {
    arabic: count(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g),
    cyrillic: count(/[\u0400-\u04FF]/g),
    hebrew: count(/[\u0590-\u05FF]/g),
    devanagari: count(/[\u0900-\u097F]/g),
    bengali: count(/[\u0980-\u09FF]/g),
    greek: count(/[\u0370-\u03FF]/g),
    armenian: count(/[\u0530-\u058F]/g),
    georgian: count(/[\u10A0-\u10FF]/g),
    hangul: count(/[\uAC00-\uD7AF]/g),
    kana: count(/[\u3040-\u30FF]/g),
    han: count(/[\u4E00-\u9FFF]/g),
    thai: count(/[\u0E00-\u0E7F]/g),
    myanmar: count(/[\u1000-\u109F]/g),
    ethiopic: count(/[\u1200-\u137F]/g),
    latin: count(/[A-Za-zÀ-ÖØ-öø-ÿ]/g),
  };

  if (counts.kana > 0) return 'ja';
  if (counts.hangul > 0) return 'ko';
  if (counts.han > 0) return 'zh';
  if (counts.hebrew > 0) return 'he';
  if (counts.devanagari > 0) return 'hi';
  if (counts.bengali > 0) return 'bn';
  if (counts.thai > 0) return 'th';
  if (counts.myanmar > 0) return 'my';
  if (counts.ethiopic > 0) return 'am';
  if (counts.greek > 0) return 'el';
  if (counts.armenian > 0) return 'hy';
  if (counts.georgian > 0) return 'ka';
  if (counts.cyrillic > 0) return 'ru';
  if (counts.arabic > 0) return 'ar';
  if (counts.latin > 0) {
    // For Latin script, keep caller hint if valid (es/fr/de/...), otherwise default to English.
    return validLanguageCodes.has(fallback) ? fallback : 'en';
  }
  return fallback;
}

export async function POST(req: Request) {
  try {
    const { title, body, tags, lang, image, video, author, user_id, org_id, author_type, username, visibility } = await req.json();

    // ✅ Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length < 3 || title.length > 100) {
      return NextResponse.json({ error: 'Title must be 3–100 characters' }, { status: 400 });
    }

    if (!body || typeof body !== 'string' || body.trim().length < 5 || body.length > 500) {
      return NextResponse.json({ error: 'Body must be 5–500 characters' }, { status: 400 });
    }

    if (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string' || tag.length > 20)) {
      return NextResponse.json({ error: 'Tags must be an array of strings (max 20 chars each)' }, { status: 400 });
    }

    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid user ID' }, { status: 400 });
    }

    if (!author || typeof author !== 'string' || author.trim().toLowerCase() === 'anonymous') {
      return NextResponse.json({ error: 'Anonymous posting is not allowed. Please post as your profile.' }, { status: 400 });
    }

    const { data: ownedBusiness } = await supabaseAdmin
      .from('businesses')
      .select('id, slug, business_name')
      .eq('owner_id', user_id)
      .maybeSingle();

    if (author_type === 'business') {
      if (!ownedBusiness || typeof username !== 'string' || username.trim() !== ownedBusiness.slug) {
        return NextResponse.json({ error: 'Invalid business post' }, { status: 400 });
      }
    }

    const visibilityValue = visibility === 'profile' ? 'profile' : 'community';

    const authorForRow =
      author_type === 'business'
        ? (ownedBusiness?.business_name?.trim() || (typeof author === 'string' ? author.trim() : ''))
        : typeof author === 'string'
          ? author.trim()
          : '';

    if (!authorForRow) {
      return NextResponse.json({ error: 'Author name required' }, { status: 400 });
    }

    const usernameForRow =
      author_type === 'business' && ownedBusiness?.slug
        ? ownedBusiness.slug
        : typeof username === 'string' && username.trim()
          ? username.trim()
          : null;

    const fallbackLang = normalizeLangCandidate(lang) || 'en';
    const detectedLanguage = detectLanguageFromText(`${title}\n${body}`, fallbackLang);

    // ✅ Insert into Supabase
    const { error } = await supabaseAdmin.from('community_posts').insert([
      {
        title: title.trim(),
        body: body.trim(),
        tags,
        image: image || null,
        video: video || null,
        language: detectedLanguage,
        author: authorForRow,
        user_id,
        org_id: org_id || null,
        author_type: author_type || null,
        username: usernameForRow,
        likes_post: 0,
        visibility: visibilityValue,
      },
    ]);
    

    if (error) {
      console.error('[Supabase Insert Error]', error.message);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API Error]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * Update an existing post, then invalidate cached translations for that post.
 * This prevents stale translated text after edits.
 */
export async function PUT(req: Request) {
  try {
    const { post_id, user_id, title, body, tags, image, video, visibility } = await req.json();

    if (!post_id || typeof post_id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid post_id' }, { status: 400 });
    }
    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid user_id' }, { status: 400 });
    }
    if (!title || typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 100) {
      return NextResponse.json({ error: 'Title must be 3–100 characters' }, { status: 400 });
    }
    if (!body || typeof body !== 'string' || body.trim().length < 5 || body.trim().length > 500) {
      return NextResponse.json({ error: 'Body must be 5–500 characters' }, { status: 400 });
    }
    if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string' || tag.length > 20)) {
      return NextResponse.json({ error: 'Tags must be an array of strings (max 20 chars each)' }, { status: 400 });
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('community_posts')
      .select('id, user_id')
      .eq('id', post_id)
      .maybeSingle();
    if (fetchError) {
      console.error('[Post fetch error]', fetchError.message);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    if (String(existing.user_id) !== String(user_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const visibilityValue = visibility === 'profile' ? 'profile' : 'community';
    const { error: updateError } = await supabaseAdmin
      .from('community_posts')
      .update({
        title: title.trim(),
        body: body.trim(),
        tags,
        image: image || null,
        video: video || null,
        visibility: visibilityValue,
      })
      .eq('id', post_id)
      .eq('user_id', user_id);

    if (updateError) {
      console.error('[Post update error]', updateError.message);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Invalidate translation cache to avoid stale translations after edits.
    const { error: clearError } = await supabaseAdmin
      .from('post_translations')
      .delete()
      .eq('post_id', post_id);
    if (clearError) {
      console.error('[Translation cache clear warning]', clearError.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PUT /api/community/post error]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
