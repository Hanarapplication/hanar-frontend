import { NextResponse } from 'next/server';
import { translatePost } from '@/services/translatePost';

const cache = new Map<string, string>();

/**
 * On-demand text translation for comment/button click flows.
 * Server-side only; no credentials exposed to client.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
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

    const translatedText = await translatePost(text, sourceLang, targetLang);
    cache.set(cacheKey, translatedText);
    return NextResponse.json({ translatedText, cached: false });
  } catch (error) {
    console.error('POST /api/translate/text failed', error);
    return NextResponse.json(
      { error: 'Translation service unavailable. Please try again.' },
      { status: 502 }
    );
  }
}
