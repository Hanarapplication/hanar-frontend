import { NextRequest, NextResponse } from 'next/server';
import { Translate } from '@google-cloud/translate/build/src/v2';
import translations from '@/utils/translations';
import { BUSINESS_CATEGORIES } from '@/utils/businessCategories';

const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_SEGMENTS_PER_REQUEST = 100;
const cache = new Map<string, { expiresAt: number; payload: Record<string, string> }>();
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

function applyUiToneOverrides(lang: string, key: string, value: string): string {
  const overridesForLang = UI_SINGULAR_TONE_OVERRIDES[lang];
  if (overridesForLang?.[key]) {
    return overridesForLang[key];
  }
  return value;
}

function buildLocalFallbackTranslations(
  lang: string,
  englishMap: Record<string, string>,
  keys: string[]
): Record<string, string> {
  const localMap = translations[lang] || {};
  const payload: Record<string, string> = {};
  keys.forEach((key) => {
    payload[key] = applyUiToneOverrides(lang, key, localMap[key] || englishMap[key] || key);
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

    let client: Translate;
    try {
      client = createTranslateClient();
    } catch (error) {
      console.error('translate-ui client init error, using local fallback', error);
      const payload = buildLocalFallbackTranslations(lang, englishMap, keys);
      cache.set(lang, { expiresAt: now + ONE_HOUR_MS, payload });
      return NextResponse.json({ lang, translations: payload, cached: false, fallback: 'local' });
    }
    const payload: Record<string, string> = {};

    for (let start = 0; start < keys.length; start += MAX_SEGMENTS_PER_REQUEST) {
      const keyChunk = keys.slice(start, start + MAX_SEGMENTS_PER_REQUEST);
      const sourceChunk = keyChunk.map((key) => englishMap[key] || key);
      const translatedChunk = await translatePreservingBrand(client, sourceChunk, lang);
      keyChunk.forEach((key, index) => {
        const translatedValue = translatedChunk[index] || englishMap[key] || key;
        payload[key] = applyUiToneOverrides(lang, key, translatedValue);
      });
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
    const payload = buildLocalFallbackTranslations(lang, englishMap, keys);
    return NextResponse.json({ lang, translations: payload, fallback: 'local-error' });
  }
}
