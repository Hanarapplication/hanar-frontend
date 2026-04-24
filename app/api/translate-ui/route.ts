import { NextRequest, NextResponse } from 'next/server';
import { Translate } from '@google-cloud/translate/build/src/v2';
import translations from '@/utils/translations';
import { BUSINESS_CATEGORIES } from '@/utils/businessCategories';

const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_SEGMENTS_PER_REQUEST = 100;
const cache = new Map<string, { expiresAt: number; payload: Record<string, string> }>();
const HANAR_SPLIT_REGEX = /(hanar)/gi;

type BrandSegment = { value: string; isBrand: boolean };

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

export async function GET(request: NextRequest) {
  try {
    const lang = resolveTargetLanguage(request.nextUrl.searchParams.get('lang'));
    if (lang === 'en') {
      return NextResponse.json({ lang, translations: {} });
    }

    const now = Date.now();
    const cached = cache.get(lang);
    if (cached && cached.expiresAt > now) {
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

    const client = createTranslateClient();
    const payload: Record<string, string> = {};

    for (let start = 0; start < keys.length; start += MAX_SEGMENTS_PER_REQUEST) {
      const keyChunk = keys.slice(start, start + MAX_SEGMENTS_PER_REQUEST);
      const sourceChunk = keyChunk.map((key) => englishMap[key] || key);
      const translatedChunk = await translatePreservingBrand(client, sourceChunk, lang);
      keyChunk.forEach((key, index) => {
        payload[key] = translatedChunk[index] || englishMap[key] || key;
      });
    }

    cache.set(lang, { expiresAt: now + ONE_HOUR_MS, payload });
    return NextResponse.json({ lang, translations: payload, cached: false });
  } catch (error) {
    console.error('translate-ui route error', error);
    return NextResponse.json(
      { error: 'Failed to load translated UI strings.' },
      { status: 500 }
    );
  }
}
