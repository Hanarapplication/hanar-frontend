import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUserId } from '@/lib/authApi';
import { translatePost } from '@/services/translatePost';
import { logTranslationUsage } from '@/lib/translationUsage';

const cache = new Map<string, string>();
const inFlightRequests = new Map<string, Promise<string>>();
const requestWindow = new Map<string, { startedAt: number; count: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const MAX_TEXT_LENGTH = 5000;
const TRANSLATION_ENABLED = String(process.env.TRANSLATION_ENABLED || 'false').toLowerCase() === 'true';

type TranslateTextBody = {
  postId?: string | number | null;
  text?: string;
  sourceLang?: string | null;
  targetLang?: string;
  targetLanguage?: string;
};

function isRateLimitError(error: unknown): boolean {
  const anyError = error as { code?: number; message?: string };
  if (anyError?.code === 403) return true;
  const message = String(anyError?.message || '').toLowerCase();
  return message.includes('rate limit') || message.includes('quota');
}

function normalizeLang(value: string | null | undefined): string | null {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'auto') return null;
  const primary = (raw.split(/[-_]/)[0] || '').trim();
  return /^[a-z]{2,3}$/.test(primary) ? primary : null;
}

function getRequesterIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(subject: string): boolean {
  const now = Date.now();
  const current = requestWindow.get(subject);
  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    requestWindow.set(subject, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= RATE_LIMIT_MAX_REQUESTS) return false;
  current.count += 1;
  requestWindow.set(subject, current);
  return true;
}

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

/**
 * On-demand text translation for comment/button click flows.
 * Server-side only; no credentials exposed to client.
 */
export async function POST(req: Request) {
  let body: TranslateTextBody = {};
  try {
    body = (await req.json()) as TranslateTextBody;

    const rawText = String(body?.text || '').trim();
    const postId = body?.postId != null ? String(body.postId).trim() : '';
    const sourceLang = normalizeLang(body?.sourceLang || null);
    const targetLang = normalizeLang(body?.targetLanguage || body?.targetLang || null);

    if (!postId && !rawText) {
      return NextResponse.json({ error: 'postId is required OR text is required.' }, { status: 400 });
    }
    if (!targetLang) return NextResponse.json({ error: 'targetLanguage is required.' }, { status: 400 });
    if (targetLang === 'en' && (!sourceLang || sourceLang === 'en')) {
      return NextResponse.json({ error: 'English-to-English translation is not allowed.' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization') || '';
    const cookieHeader = req.headers.get('cookie') || '';
    const authExists = authHeader.startsWith('Bearer ') || cookieHeader.includes('sb-');
    const userId = await getAuthenticatedUserId(req).catch(() => null);
    if (authExists && !userId) {
      return NextResponse.json({ error: 'Unauthorized translation request.' }, { status: 401 });
    }

    const requesterIp = getRequesterIp(req);
    const subject = userId ? `user:${userId}` : `ip:${requesterIp}`;
    if (!checkRateLimit(subject)) {
      await logTranslationUsage({
        endpointName: 'api/translate/text',
        userId,
        ipAddress: requesterIp,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        characterCount: rawText.length,
        textPreview: rawText,
        cacheHit: false,
        reason: 'rate limited',
        paidCall: false,
        blocked: true,
      });
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }

    let text = rawText;
    if (!text && postId) {
      const supabaseAdmin = createSupabaseAdminClient();
      if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Server translation backend is not configured.' }, { status: 500 });
      }
      const { data: post, error: postError } = await supabaseAdmin
        .from('community_posts')
        .select('body')
        .eq('id', postId)
        .maybeSingle<{ body: string }>();
      if (postError) {
        return NextResponse.json({ error: 'Failed to load post text for translation.' }, { status: 500 });
      }
      text = String(post?.body || '').trim();
    }

    if (!text) return NextResponse.json({ error: 'No text available to translate.' }, { status: 400 });
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: `Text exceeds max length (${MAX_TEXT_LENGTH}).` }, { status: 400 });
    }

    const cacheKey = `${sourceLang || ''}::${targetLang}::${text}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      await logTranslationUsage({
        endpointName: 'api/translate/text',
        userId,
        ipAddress: requesterIp,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        characterCount: text.length,
        textPreview: text,
        cacheHit: true,
        reason: 'memory cache hit',
        paidCall: false,
        blocked: false,
      });
      return NextResponse.json({ translatedText: cached, cached: true });
    }

    const existingPromise = inFlightRequests.get(cacheKey);
    if (existingPromise) {
      const translatedText = await existingPromise;
      await logTranslationUsage({
        endpointName: 'api/translate/text',
        userId,
        ipAddress: requesterIp,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        characterCount: text.length,
        textPreview: text,
        cacheHit: true,
        reason: 'in-flight dedupe hit',
        paidCall: false,
        blocked: false,
      });
      return NextResponse.json({ translatedText, cached: true, deduped: true });
    }

    if (!TRANSLATION_ENABLED) {
      await logTranslationUsage({
        endpointName: 'api/translate/text',
        userId,
        ipAddress: requesterIp,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        characterCount: text.length,
        textPreview: text,
        cacheHit: false,
        reason: 'disabled by TRANSLATION_ENABLED',
        paidCall: false,
        blocked: true,
      });
      return NextResponse.json({
        translatedText: text,
        cached: false,
        fallback: 'translation-disabled',
      });
    }

    const pending = translatePost(text, sourceLang, targetLang, {
      subjectKey: `translate-text:${subject}`,
      endpointName: 'api/translate/text',
      userId,
      ipAddress: requesterIp,
    });
    inFlightRequests.set(cacheKey, pending);
    let translatedText = '';
    try {
      translatedText = await pending;
    } finally {
      inFlightRequests.delete(cacheKey);
    }

    cache.set(cacheKey, translatedText);
    return NextResponse.json({ translatedText, cached: false });
  } catch (error) {
    const message = String((error as { message?: string })?.message || '');
    if (message.toLowerCase().includes('daily translation character limit')) {
      await logTranslationUsage({
        endpointName: 'api/translate/text',
        sourceLanguage: normalizeLang(body?.sourceLang || null),
        targetLanguage: normalizeLang(body?.targetLanguage || body?.targetLang || null),
        characterCount: String(body?.text || '').trim().length,
        textPreview: String(body?.text || '').trim(),
        cacheHit: false,
        reason: 'daily limit reached',
        paidCall: false,
        blocked: true,
      });
      return NextResponse.json({ error: message }, { status: 429 });
    }
    if (isRateLimitError(error)) {
      await logTranslationUsage({
        endpointName: 'api/translate/text',
        sourceLanguage: normalizeLang(body?.sourceLang || null),
        targetLanguage: normalizeLang(body?.targetLanguage || body?.targetLang || null),
        characterCount: String(body?.text || '').trim().length,
        textPreview: String(body?.text || '').trim(),
        cacheHit: false,
        reason: 'rate limited/quota',
        paidCall: false,
        blocked: true,
      });
      return NextResponse.json({ error: 'Translation quota reached. Please try later.' }, { status: 429 });
    }
    console.error('POST /api/translate/text failed', error);
    return NextResponse.json({
      translatedText: String(body?.text || '').trim(),
      cached: false,
      fallback: 'original',
    });
  }
}
