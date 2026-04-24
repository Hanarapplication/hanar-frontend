import { NextResponse } from 'next/server';
import { translatePost } from '@/services/translatePost';

const cache = new Map<string, string>();
const RATE_LIMIT_COOLDOWN_MS = 10 * 60 * 1000;
let rateLimitBlockedUntil = 0;

function isRateLimitError(error: unknown): boolean {
  const anyError = error as { code?: number; message?: string };
  if (anyError?.code === 403) return true;
  const message = String(anyError?.message || '').toLowerCase();
  return message.includes('rate limit') || message.includes('quota');
}

/**
 * On-demand text translation for comment/button click flows.
 * Server-side only; no credentials exposed to client.
 */
export async function POST(req: Request) {
  let body: {
    text?: string;
    sourceLang?: string | null;
    targetLang?: string;
  } = {};
  try {
    body = (await req.json()) as {
      text?: string;
      sourceLang?: string | null;
      targetLang?: string;
    };

    const text = String(body?.text || '').trim();
    const targetLang = String(body?.targetLang || '').trim().toLowerCase();
    const sourceLang = String(body?.sourceLang || '').trim().toLowerCase() || null;

    if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    if (!targetLang) return NextResponse.json({ error: 'Missing targetLang' }, { status: 400 });

    const cacheKey = `${sourceLang || ''}::${targetLang}::${text}`;
    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json({ translatedText: cached, cached: true });
    if (Date.now() < rateLimitBlockedUntil) {
      return NextResponse.json({
        translatedText: text,
        cached: false,
        fallback: 'rate-limit-cooldown',
      });
    }

    const translatedText = await translatePost(text, sourceLang, targetLang);
    cache.set(cacheKey, translatedText);
    return NextResponse.json({ translatedText, cached: false });
  } catch (error) {
    if (isRateLimitError(error)) {
      rateLimitBlockedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    }
    console.error('POST /api/translate/text failed', error);
    return NextResponse.json({
      translatedText: String(body?.text || '').trim(),
      cached: false,
      fallback: 'original',
    });
  }
}
