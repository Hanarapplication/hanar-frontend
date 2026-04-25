import { NextRequest, NextResponse } from 'next/server';
import { Translate } from '@google-cloud/translate/build/src/v2';
import { createClient } from '@supabase/supabase-js';
import translations from '@/utils/translations';
import { BUSINESS_CATEGORIES } from '@/utils/businessCategories';
import { getAuthenticatedUserId } from '@/lib/authApi';
import { logTranslationUsage } from '@/lib/translationUsage';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_SEGMENTS_PER_REQUEST = 100;
const CACHE_SOURCE_LANGUAGE = 'en';
const TRANSLATION_ENABLED = String(process.env.TRANSLATION_ENABLED || 'false').toLowerCase() === 'true';
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_REQUESTS_PER_WINDOW = 30;
const DAILY_QUOTA_CHARS_PER_SUBJECT = Number(process.env.TRANSLATION_DAILY_CHAR_LIMIT || 50000);
const cache = new Map<string, { expiresAt: number; payload: Record<string, string> }>();
const localeBundleCache = new Map<string, Record<string, string>>();
const requestRateWindow = new Map<string, { windowStartedAt: number; count: number }>();
const HANAR_SPLIT_REGEX = /(hanar)/gi;
const UI_SINGULAR_TONE_OVERRIDES: Record<string, Record<string, string>> = {
  fa: {
    'Ask the community...': 'از جامعه بپرس...',
    'Write a comment...': 'یک نظر بنویس...',
    'Log in to write a comment': 'برای نوشتن نظر وارد شوید',
    'Post comment': 'ارسال نظر',
  },
  ar: {
    'Ask the community...': 'اسأل المجتمع...',
    'Write a comment...': 'اكتب تعليقًا...',
    'Log in to write a comment': 'سجّل الدخول لكتابة تعليق',
    'Post comment': 'أرسل التعليق',
  },
  es: {
    'Ask the community...': 'Pregunta a la comunidad...',
    'Write a comment...': 'Escribe un comentario...',
    'Log in to write a comment': 'Inicia sesión para escribir un comentario',
    'Post comment': 'Publicar comentario',
  },
  fr: {
    'Ask the community...': 'Demande a la communaute...',
    'Write a comment...': 'Ecris un commentaire...',
    'Log in to write a comment': 'Connecte-toi pour ecrire un commentaire',
    'Post comment': 'Publier le commentaire',
  },
  de: {
    'Ask the community...': 'Frag die Community...',
    'Write a comment...': 'Schreib einen Kommentar...',
    'Log in to write a comment': 'Melde dich an, um einen Kommentar zu schreiben',
    'Post comment': 'Kommentar posten',
  },
  it: {
    'Ask the community...': 'Chiedi alla community...',
    'Write a comment...': 'Scrivi un commento...',
    'Log in to write a comment': 'Accedi per scrivere un commento',
    'Post comment': 'Pubblica commento',
  },
  pt: {
    'Ask the community...': 'Pergunta a comunidade...',
    'Write a comment...': 'Escreve um comentario...',
    'Log in to write a comment': 'Faz login para escrever um comentario',
    'Post comment': 'Publicar comentario',
  },
  ru: {
    'Ask the community...': 'Спроси сообщество...',
    'Write a comment...': 'Напиши комментарий...',
    'Log in to write a comment': 'Войди, чтобы написать комментарий',
    'Post comment': 'Отправить комментарий',
  },
  tr: {
    'Ask the community...': 'Topluluga sor...',
    'Write a comment...': 'Yorum yaz...',
    'Log in to write a comment': 'Yorum yazmak icin giris yap',
    'Post comment': 'Yorumu gonder',
  },
  he: {
    'Ask the community...': 'שאל את הקהילה...',
    'Write a comment...': 'כתוב תגובה...',
    'Log in to write a comment': 'התחבר כדי לכתוב תגובה',
    'Post comment': 'פרסם תגובה',
  },
  ur: {
    'Ask the community...': 'کمیونٹی سے پوچھ...',
    'Write a comment...': 'تبصرہ لکھ...',
    'Log in to write a comment': 'تبصرہ لکھنے کے لئے لاگ ان کرو',
    'Post comment': 'تبصرہ پوسٹ کرو',
  },
  hi: {
    'Ask the community...': 'कम्युनिटी से पूछो...',
    'Write a comment...': 'टिप्पणी लिखो...',
    'Log in to write a comment': 'टिप्पणी लिखने के लिए लॉग इन करो',
    'Post comment': 'टिप्पणी पोस्ट करो',
  },
};

type BrandSegment = { value: string; isBrand: boolean };
type TranslationCacheRow = {
  source_text: string;
  translated_text: string;
  source_hash: string;
};

function splitBrandSegments(text: string): BrandSegment[] {
  return text
    .split(HANAR_SPLIT_REGEX)
    .filter((part) => part.length > 0)
    .map((part) => ({ value: part, isBrand: /^hanar$/i.test(part) }));
}

async function translatePreservingBrand(client: Translate, inputs: string[], lang: string): Promise<string[]> {
  const segmented = inputs.map((text) => splitBrandSegments(text));
  const translatable: string[] = [];
  segmented.forEach((parts) => {
    parts.forEach((part) => {
      if (!part.isBrand && part.value.trim()) translatable.push(part.value);
    });
  });

  let translatedCursor = 0;
  let translatedParts: string[] = [];
  if (translatable.length > 0) {
    const [translatedValues] = await client.translate(translatable, { to: lang });
    translatedParts = (Array.isArray(translatedValues) ? translatedValues : [translatedValues]).map((v) => String(v || ''));
  }

  return segmented.map((parts) =>
    parts
      .map((part) => {
        if (part.isBrand) return part.value;
        if (!part.value.trim()) return part.value;
        const value = translatedParts[translatedCursor] ?? part.value;
        translatedCursor += 1;
        return value;
      })
      .join('')
  );
}

function resolveTargetLanguage(value: string | null): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'auto') return 'en';
  return raw;
}

function createTranslateClient() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const inlineJson = process.env.GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON;

  if (inlineJson) {
    const credentials = JSON.parse(inlineJson);
    return new Translate({ projectId, credentials });
  }

  return new Translate({ projectId });
}

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

function stableHash(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function getRequesterIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(subjectKey: string): boolean {
  const now = Date.now();
  const current = requestRateWindow.get(subjectKey);
  if (!current || now - current.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    requestRateWindow.set(subjectKey, { windowStartedAt: now, count: 1 });
    return true;
  }
  if (current.count >= RATE_LIMIT_REQUESTS_PER_WINDOW) return false;
  current.count += 1;
  requestRateWindow.set(subjectKey, current);
  return true;
}

async function consumeDailyQuota(
  supabaseAdmin: any,
  subjectKey: string,
  charsToAdd: number
): Promise<boolean> {
  if (!supabaseAdmin) return true;
  const usageDate = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from('ui_translation_usage_daily')
    .select('chars_used, request_count')
    .eq('usage_date', usageDate)
    .eq('subject_key', subjectKey)
    .maybeSingle();
  if (error) {
    console.error('translation usage read error', error);
    return true;
  }
  const currentChars = Number(data?.chars_used || 0);
  const currentRequests = Number(data?.request_count || 0);
  const nextChars = currentChars + Math.max(0, charsToAdd);
  if (nextChars > DAILY_QUOTA_CHARS_PER_SUBJECT) return false;

  const { error: upsertError } = await supabaseAdmin.from('ui_translation_usage_daily').upsert(
    {
      usage_date: usageDate,
      subject_key: subjectKey,
      chars_used: nextChars,
      request_count: currentRequests + 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'usage_date,subject_key' }
  );
  if (upsertError) {
    console.error('translation usage upsert error', upsertError);
  }
  return true;
}

async function loadPersistentCache(
  supabaseAdmin: any,
  targetLanguage: string,
  sourceTexts: string[]
): Promise<Record<string, string>> {
  if (!supabaseAdmin || sourceTexts.length === 0) return {};
  const hashes = sourceTexts.map((text) => stableHash(text));
  const { data, error } = await supabaseAdmin
    .from('ui_translation_cache')
    .select('source_text, translated_text, source_hash')
    .eq('source_language', CACHE_SOURCE_LANGUAGE)
    .eq('target_language', targetLanguage)
    .in('source_hash', hashes);

  if (error || !data) {
    if (error) console.error('translation cache read error', error);
    return {};
  }

  const map: Record<string, string> = {};
  (data as TranslationCacheRow[]).forEach((row) => {
    if (stableHash(row.source_text) !== row.source_hash) return;
    map[row.source_text] = row.translated_text;
  });
  return map;
}

async function savePersistentCache(
  supabaseAdmin: any,
  targetLanguage: string,
  entries: Array<{ sourceText: string; translatedText: string }>
): Promise<void> {
  if (!supabaseAdmin || entries.length === 0) return;
  const rows = entries.map((entry) => ({
    source_language: CACHE_SOURCE_LANGUAGE,
    target_language: targetLanguage,
    source_text: entry.sourceText,
    source_hash: stableHash(entry.sourceText),
    translated_text: entry.translatedText,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabaseAdmin.from('ui_translation_cache').upsert(rows, {
    onConflict: 'source_language,target_language,source_hash',
  });
  if (error) {
    console.error('translation cache save error', error);
  }
}

function applyUiToneOverrides(lang: string, key: string, value: string): string {
  const overridesForLang = UI_SINGULAR_TONE_OVERRIDES[lang];
  if (overridesForLang?.[key]) {
    return overridesForLang[key];
  }
  return value;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function readLocaleBundle(lang: string): Promise<Record<string, string>> {
  if (localeBundleCache.has(lang)) return localeBundleCache.get(lang) || {};
  try {
    const filePath = path.join(process.cwd(), 'public', 'locales', `${lang}.json`);
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, string>;
    const safeMap = parsed && typeof parsed === 'object' ? parsed : {};
    localeBundleCache.set(lang, safeMap);
    return safeMap;
  } catch {
    localeBundleCache.set(lang, {});
    return {};
  }
}

async function buildLocalFallbackTranslations(
  lang: string,
  englishMap: Record<string, string>,
  keys: string[]
): Promise<Record<string, string>> {
  const localeBundleMap = await readLocaleBundle(lang);
  const localMap = translations[lang] || {};
  const payload: Record<string, string> = {};
  keys.forEach((key) => {
    payload[key] = applyUiToneOverrides(lang, key, localeBundleMap[key] || localMap[key] || englishMap[key] || key);
  });
  return payload;
}

export async function GET(request: NextRequest) {
  try {
    const lang = resolveTargetLanguage(request.nextUrl.searchParams.get('lang'));
    if (lang === 'en') {
      return NextResponse.json({ lang, translations: {} });
    }

    const now = Date.now();
    const cached = cache.get(lang);
    if (cached && cached.expiresAt > now) {
      console.log(`[translate-ui] UI translation cache hit (memory) | lang=${lang}`);
      return NextResponse.json({ lang, translations: cached.payload, cached: true });
    }

    const englishMap = translations.en || {};
    const categoryKeys = BUSINESS_CATEGORIES.flatMap((cat) => [
      cat.label,
      ...cat.subcategories.map((sub) => sub.label),
    ]);
    const keys = Array.from(
      new Set([
        ...Object.keys(englishMap),
        ...categoryKeys,
        'Select a category',
        'Choose business category',
        'Subcategory',
      ])
    );
    if (keys.length === 0) return NextResponse.json({ lang, translations: {} });

    const payload: Record<string, string> = {};
    const localeBundleMap = await readLocaleBundle(lang);
    const supabaseAdmin = createSupabaseAdminClient();
    const requesterIp = getRequesterIp(request);
    const userId = await getAuthenticatedUserId(request).catch(() => null);
    const subjectKey = userId ? `user:${userId}` : `ip:${requesterIp}`;

    if (!checkRateLimit(subjectKey)) {
      await logTranslationUsage({
        endpointName: 'api/translate-ui:GET',
        userId,
        ipAddress: requesterIp,
        sourceLanguage: CACHE_SOURCE_LANGUAGE,
        targetLanguage: lang,
        characterCount: 0,
        textPreview: '',
        cacheHit: false,
        reason: 'rate limited',
        paidCall: false,
        blocked: true,
      });
      return NextResponse.json({ error: 'Rate limit exceeded for translations.' }, { status: 429 });
    }

    // 1) Local static translations first.
    const googleCandidates: string[] = [];
    keys.forEach((key) => {
      const localValue = localeBundleMap[key];
      if (localValue) {
        payload[key] = applyUiToneOverrides(lang, key, localValue);
      } else {
        googleCandidates.push(key);
      }
    });

    // 2) Persistent DB cache before Google.
    const cachedTranslations = await loadPersistentCache(supabaseAdmin, lang, googleCandidates);
    const missingForGoogle = googleCandidates.filter((key) => !cachedTranslations[key]);
    if (googleCandidates.length > 0 && missingForGoogle.length === 0) {
      console.log(`[translate-ui] UI translation cache hit (db) | lang=${lang} keys=${googleCandidates.length}`);
      await logTranslationUsage({
        endpointName: 'api/translate-ui:GET',
        userId,
        ipAddress: requesterIp,
        sourceLanguage: CACHE_SOURCE_LANGUAGE,
        targetLanguage: lang,
        characterCount: 0,
        textPreview: '',
        cacheHit: true,
        reason: 'ui cache hit',
        paidCall: false,
        blocked: false,
      });
    }
    googleCandidates.forEach((key) => {
      if (cachedTranslations[key]) {
        payload[key] = applyUiToneOverrides(lang, key, cachedTranslations[key]);
      }
    });

    // GET is cache-only: never generate new Google translations here.
    if (missingForGoogle.length > 0) {
      console.log(`[translate-ui] UI translation missing, fallback to English | lang=${lang} missing_keys=${missingForGoogle.length}`);
    }
    missingForGoogle.forEach((key) => {
      payload[key] = applyUiToneOverrides(lang, key, localeBundleMap[key] || translations[lang]?.[key] || englishMap[key] || key);
    });

    keys.forEach((key) => {
      if (!payload[key]) {
        payload[key] = applyUiToneOverrides(lang, key, localeBundleMap[key] || englishMap[key] || key);
      }
    });

    for (const [key, value] of Object.entries(localeBundleMap)) {
      if (!value) continue;
      payload[key] = applyUiToneOverrides(lang, key, value);
    }

    cache.set(lang, { expiresAt: now + ONE_HOUR_MS, payload });
    return NextResponse.json({ lang, translations: payload, cached: false });
  } catch (error) {
    console.error('translate-ui route error', error);
    const lang = resolveTargetLanguage(request.nextUrl.searchParams.get('lang'));
    const englishMap = translations.en || {};
    const categoryKeys = BUSINESS_CATEGORIES.flatMap((cat) => [
      cat.label,
      ...cat.subcategories.map((sub) => sub.label),
    ]);
    const keys = Array.from(
      new Set([
        ...Object.keys(englishMap),
        ...categoryKeys,
        'Select a category',
        'Choose business category',
        'Subcategory',
      ])
    );
    const payload = await buildLocalFallbackTranslations(lang, englishMap, keys);
    return NextResponse.json({ lang, translations: payload, fallback: 'local-error' });
  }
}

export async function POST(request: NextRequest) {
  try {
    // POST translation generation should only be used manually/admin-side, not by normal users.
    const expectedSecret = String(process.env.ADMIN_TRANSLATION_SECRET || '').trim();
    const providedSecret = String(request.headers.get('x-admin-translation-secret') || '').trim();
    if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
      console.warn('[translate-ui] blocked unauthorized POST');
      await logTranslationUsage({
        endpointName: 'api/translate-ui:POST',
        sourceLanguage: CACHE_SOURCE_LANGUAGE,
        targetLanguage: null,
        characterCount: 0,
        textPreview: '',
        cacheHit: false,
        reason: 'unauthorized POST',
        paidCall: false,
        blocked: true,
      });
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const now = Date.now();
    const body = (await request.json()) as { lang?: string; texts?: string[] };
    const lang = resolveTargetLanguage(body?.lang || null);
    const rawTexts = Array.isArray(body?.texts) ? body.texts : [];
    const uniqueTexts = Array.from(
      new Set(
        rawTexts
          .map((text) => String(text || '').trim())
          .filter((text) => text.length > 0)
      )
    ).slice(0, 500);

    if (lang === 'en' || uniqueTexts.length === 0) {
      return NextResponse.json({ lang, translations: {} });
    }

    const requesterIp = getRequesterIp(request);
    const userId = await getAuthenticatedUserId(request).catch(() => null);
    const subjectKey = userId ? `user:${userId}` : `ip:${requesterIp}`;
    if (!checkRateLimit(subjectKey)) {
      await logTranslationUsage({
        endpointName: 'api/translate-ui:POST',
        userId,
        ipAddress: requesterIp,
        sourceLanguage: CACHE_SOURCE_LANGUAGE,
        targetLanguage: lang,
        characterCount: uniqueTexts.reduce((sum, text) => sum + text.length, 0),
        textPreview: uniqueTexts[0] || '',
        cacheHit: false,
        reason: 'rate limited',
        paidCall: false,
        blocked: true,
      });
      return NextResponse.json({ error: 'Rate limit exceeded for translations.' }, { status: 429 });
    }

    const englishMap = translations.en || {};
    const localeBundleMap = await readLocaleBundle(lang);
    const localMap = translations[lang] || {};
    const payload: Record<string, string> = {};
    const unresolvedTexts: string[] = [];
    const supabaseAdmin = createSupabaseAdminClient();

    uniqueTexts.forEach((key) => {
      const localValue = localeBundleMap[key] || localMap[key] || englishMap[key];
      if (localValue) {
        payload[key] = applyUiToneOverrides(lang, key, localValue);
      } else {
        unresolvedTexts.push(key);
      }
    });

    if (unresolvedTexts.length === 0) {
      return NextResponse.json({ lang, translations: payload });
    }

    const cachedTranslations = await loadPersistentCache(supabaseAdmin, lang, unresolvedTexts);
    const missingTexts = unresolvedTexts.filter((key) => !cachedTranslations[key]);
    unresolvedTexts.forEach((key) => {
      if (cachedTranslations[key]) {
        payload[key] = applyUiToneOverrides(lang, key, cachedTranslations[key]);
      }
    });

    if (missingTexts.length === 0) {
      return NextResponse.json({ lang, translations: payload, cache: 'persistent-hit' });
    }

    if (!TRANSLATION_ENABLED) {
      await logTranslationUsage({
        endpointName: 'api/translate-ui:POST',
        userId,
        ipAddress: requesterIp,
        sourceLanguage: CACHE_SOURCE_LANGUAGE,
        targetLanguage: lang,
        characterCount: missingTexts.reduce((sum, text) => sum + text.length, 0),
        textPreview: missingTexts[0] || '',
        cacheHit: false,
        reason: 'disabled by TRANSLATION_ENABLED',
        paidCall: false,
        blocked: true,
      });
      missingTexts.forEach((key) => {
        payload[key] = applyUiToneOverrides(lang, key, localeBundleMap[key] || localMap[key] || englishMap[key] || key);
      });
      return NextResponse.json({ lang, translations: payload, fallback: 'translation-disabled' });
    }

    const totalChars = missingTexts.reduce((sum, text) => sum + text.length, 0);
    const withinQuota = await consumeDailyQuota(supabaseAdmin, subjectKey, totalChars);
    if (!withinQuota) {
      await logTranslationUsage({
        endpointName: 'api/translate-ui:POST',
        userId,
        ipAddress: requesterIp,
        sourceLanguage: CACHE_SOURCE_LANGUAGE,
        targetLanguage: lang,
        characterCount: totalChars,
        textPreview: missingTexts[0] || '',
        cacheHit: false,
        reason: 'daily limit reached',
        paidCall: false,
        blocked: true,
      });
      return NextResponse.json({ error: 'Daily translation quota exceeded.' }, { status: 429 });
    }

    let client: Translate;
    try {
      client = createTranslateClient();
    } catch (error) {
      console.error('translate-ui dynamic client init error, using key fallback', error);
      missingTexts.forEach((key) => {
        payload[key] = applyUiToneOverrides(lang, key, key);
      });
      return NextResponse.json({ lang, translations: payload, fallback: 'local' });
    }

    await logTranslationUsage({
      endpointName: 'api/translate-ui:POST',
      userId,
      ipAddress: requesterIp,
      sourceLanguage: CACHE_SOURCE_LANGUAGE,
      targetLanguage: lang,
      characterCount: missingTexts.reduce((sum, text) => sum + text.length, 0),
      textPreview: missingTexts[0] || '',
      cacheHit: false,
      reason: 'manual/admin ui translation generation',
      paidCall: true,
      blocked: false,
    });

    const rowsToCache: Array<{ sourceText: string; translatedText: string }> = [];
    const chunks = chunkArray(missingTexts, MAX_SEGMENTS_PER_REQUEST);
    for (const chunk of chunks) {
      const translated = await translatePreservingBrand(client, chunk, lang);
      chunk.forEach((key, index) => {
        const value = translated[index] || key;
        const finalValue = applyUiToneOverrides(lang, key, value);
        payload[key] = finalValue;
        rowsToCache.push({ sourceText: key, translatedText: finalValue });
      });
    }
    await savePersistentCache(supabaseAdmin, lang, rowsToCache);

    cache.set(lang, { expiresAt: now + ONE_HOUR_MS, payload });
    return NextResponse.json({ lang, translations: payload });
  } catch (error) {
    console.error('translate-ui POST route error', error);
    return NextResponse.json({ error: 'Failed to translate UI text.' }, { status: 500 });
  }
}
