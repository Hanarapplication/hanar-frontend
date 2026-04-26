import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import translations from '@/utils/translations';
import { BUSINESS_CATEGORIES } from '@/utils/businessCategories';

function resolveTargetLanguage(value: string | null): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'auto') return 'en';
  return raw;
}

async function readLocaleBundle(lang: string): Promise<Record<string, string>> {
  try {
    const filePath = path.join(process.cwd(), 'public', 'locales', `${lang}.json`);
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function buildTranslationPayload(lang: string, localeBundleMap: Record<string, string>) {
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
      ...Object.keys(localeBundleMap),
    ])
  );

  const payload: Record<string, string> = {};
  keys.forEach((key) => {
    payload[key] = localeBundleMap[key] || translations[lang]?.[key] || englishMap[key] || key;
  });
  return payload;
}

export async function GET(request: NextRequest) {
  try {
    const lang = resolveTargetLanguage(request.nextUrl.searchParams.get('lang'));
    if (lang === 'en') {
      return NextResponse.json({ lang, translations: {} });
    }

    const localeBundleMap = await readLocaleBundle(lang);
    const payload = buildTranslationPayload(lang, localeBundleMap);
    return NextResponse.json({ lang, translations: payload, source: 'locale-json' });
  } catch (error) {
    console.error('translate-ui route error', error);
    const lang = resolveTargetLanguage(request.nextUrl.searchParams.get('lang'));
    const localeBundleMap = await readLocaleBundle(lang);
    const payload = buildTranslationPayload(lang, localeBundleMap);
    return NextResponse.json({ lang, translations: payload, fallback: 'local-error' });
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'UI translation generation is disabled. Add/update values in public/locales/*.json files.',
    },
    { status: 405 }
  );
}
