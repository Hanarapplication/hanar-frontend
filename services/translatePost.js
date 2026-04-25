import { v3 } from '@google-cloud/translate';
import { Translate as TranslateV2 } from '@google-cloud/translate/build/src/v2';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const { TranslationServiceClient } = v3;
const MAX_TRANSLATE_TEXT_LENGTH = 5000;
const TRANSLATION_ENABLED = String(process.env.TRANSLATION_ENABLED || 'false').toLowerCase() === 'true';
const DAILY_TRANSLATE_CHAR_LIMIT = Number(process.env.TRANSLATION_DAILY_CHAR_LIMIT || 50000);
const CACHE_SOURCE_FALLBACK = 'auto';
const runtimeCache = new Map();

function normalizeLang(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'auto') return null;
  const primary = (raw.split(/[-_]/)[0] || '').trim();
  return /^[a-z]{2,3}$/.test(primary) ? primary : null;
}

function buildHash(sourceLang, originalText) {
  return crypto.createHash('sha256').update(`${sourceLang}::${originalText}`, 'utf8').digest('hex');
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

async function logUsage(supabaseAdmin, payload) {
  try {
    if (!supabaseAdmin) return;
    const { error } = await supabaseAdmin.from('translation_usage_logs').insert({
      endpoint_name: String(payload.endpointName || 'translatePost'),
      user_id: payload.userId || null,
      ip_address: payload.ipAddress || null,
      source_language: payload.sourceLanguage || null,
      target_language: payload.targetLanguage || null,
      character_count: Math.max(0, Number(payload.characterCount || 0)),
      text_preview: String(payload.textPreview || '').slice(0, 80) || null,
      cache_hit: !!payload.cacheHit,
      reason: payload.reason || null,
      paid_call: !!payload.paidCall,
      blocked: !!payload.blocked,
    });
    if (error) {
      console.error('[translatePost] usage log error', error);
    }
  } catch (error) {
    console.error('[translatePost] usage log unexpected error', error);
  }
}

async function consumeDailyChars(supabaseAdmin, subjectKey, chars) {
  if (!supabaseAdmin) return true;
  const usageDate = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from('ui_translation_usage_daily')
    .select('chars_used, request_count')
    .eq('usage_date', usageDate)
    .eq('subject_key', subjectKey)
    .maybeSingle();
  if (error) {
    console.error('[translatePost] usage read error', error);
    return true;
  }
  const currentChars = Number(data?.chars_used || 0);
  const currentRequests = Number(data?.request_count || 0);
  const nextChars = currentChars + Math.max(0, chars);
  if (nextChars > DAILY_TRANSLATE_CHAR_LIMIT) return false;
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
    console.error('[translatePost] usage upsert error', upsertError);
  }
  return true;
}

/**
 * Translates post content using Google Cloud Translation API v3.
 *
 * Auth is handled by GOOGLE_APPLICATION_CREDENTIALS on the server.
 */
export async function translatePost(content, sourceLang, targetLang, options = {}) {
  const text = String(content || '').trim();
  if (!text) return '';
  if (text.length > MAX_TRANSLATE_TEXT_LENGTH) {
    throw new Error(`Text exceeds max translation length (${MAX_TRANSLATE_TEXT_LENGTH}).`);
  }

  const src = normalizeLang(sourceLang);
  const target = normalizeLang(targetLang);
  if (!target) throw new Error('Missing target language');
  if (src === target) return text;

  const sourceForCache = src || CACHE_SOURCE_FALLBACK;
  const sourceHash = buildHash(sourceForCache, text);
  const cacheKey = `${sourceForCache}:${target}:${sourceHash}`;
  const endpointName = String(options?.endpointName || 'services/translatePost');
  const userId = options?.userId || null;
  const ipAddress = options?.ipAddress || null;
  const runtimeHit = runtimeCache.get(cacheKey);
  const supabaseAdmin = getSupabaseAdminClient();
  if (runtimeHit) {
    console.log(`[translatePost] cache hit | target=${target} chars=${text.length}`);
    await logUsage(supabaseAdmin, {
      endpointName,
      userId,
      ipAddress,
      sourceLanguage: sourceForCache,
      targetLanguage: target,
      characterCount: text.length,
      textPreview: text,
      cacheHit: true,
      reason: 'runtime cache hit',
      paidCall: false,
      blocked: false,
    });
    return runtimeHit;
  }

  if (supabaseAdmin) {
    const { data: cached, error: cacheReadError } = await supabaseAdmin
      .from('ui_translation_cache')
      .select('translated_text')
      .eq('source_language', sourceForCache)
      .eq('target_language', target)
      .eq('source_hash', sourceHash)
      .maybeSingle();
    if (cacheReadError) {
      console.error('[translatePost] cache read error', cacheReadError);
    } else if (cached?.translated_text) {
      const translated = String(cached.translated_text || '');
      runtimeCache.set(cacheKey, translated);
      console.log(`[translatePost] cache hit | target=${target} chars=${text.length}`);
      await logUsage(supabaseAdmin, {
        endpointName,
        userId,
        ipAddress,
        sourceLanguage: sourceForCache,
        targetLanguage: target,
        characterCount: text.length,
        textPreview: text,
        cacheHit: true,
        reason: 'database cache hit',
        paidCall: false,
        blocked: false,
      });
      return translated;
    }
  }

  if (!TRANSLATION_ENABLED) {
    console.log(`[translatePost] translation disabled, returning original | target=${target} chars=${text.length}`);
    await logUsage(supabaseAdmin, {
      endpointName,
      userId,
      ipAddress,
      sourceLanguage: sourceForCache,
      targetLanguage: target,
      characterCount: text.length,
      textPreview: text,
      cacheHit: false,
      reason: 'disabled by TRANSLATION_ENABLED',
      paidCall: false,
      blocked: true,
    });
    return text;
  }
  console.log(`[translatePost] cache miss | target=${target} chars=${text.length}`);

  const subjectKey = String(options?.subjectKey || 'translate-text:global');
  const withinDailyLimit = await consumeDailyChars(supabaseAdmin, subjectKey, text.length);
  if (!withinDailyLimit) {
    await logUsage(supabaseAdmin, {
      endpointName,
      userId,
      ipAddress,
      sourceLanguage: sourceForCache,
      targetLanguage: target,
      characterCount: text.length,
      textPreview: text,
      cacheHit: false,
      reason: 'daily limit reached',
      paidCall: false,
      blocked: true,
    });
    throw new Error(`Daily translation character limit reached (${DAILY_TRANSLATE_CHAR_LIMIT}).`);
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (!projectId) {
    throw new Error('Missing GOOGLE_CLOUD_PROJECT_ID for Translation API v3');
  }

  const parent = `projects/${projectId}/locations/global`;
  await logUsage(supabaseAdmin, {
    endpointName,
    userId,
    ipAddress,
    sourceLanguage: sourceForCache,
    targetLanguage: target,
    characterCount: text.length,
    textPreview: text,
    cacheHit: false,
    reason: 'paid translation call',
    paidCall: true,
    blocked: false,
  });

  // Prefer v3, but fall back to v2 if v3 API is not enabled.
  let translatedResult = text;
  try {
    const client = new TranslationServiceClient();
    const [response] = await client.translateText({
      parent,
      contents: [text],
      mimeType: 'text/plain',
      sourceLanguageCode: src || undefined,
      targetLanguageCode: target,
    });
    translatedResult = response?.translations?.[0]?.translatedText || text;
  } catch (v3Error) {
    const fallbackClient = new TranslateV2({ projectId });
    const [translated] = await fallbackClient.translate(text, { from: src || undefined, to: target });
    translatedResult = String(translated || text);
  }

  runtimeCache.set(cacheKey, translatedResult);
  if (supabaseAdmin) {
    const { error: cacheWriteError } = await supabaseAdmin.from('ui_translation_cache').upsert(
      {
        source_language: sourceForCache,
        target_language: target,
        source_text: text,
        source_hash: sourceHash,
        translated_text: translatedResult,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'source_language,target_language,source_hash' }
    );
    if (cacheWriteError) {
      console.error('[translatePost] cache write error', cacheWriteError);
    }
  }
  return translatedResult;
}

export default translatePost;
