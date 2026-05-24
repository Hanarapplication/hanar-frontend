/**
 * Fill business category + subcategory labels in public/locales/*.json
 * Preserves existing translations; only adds missing keys.
 *
 * Usage: node scripts/add-business-category-translations.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LOCALES_DIR = path.join(ROOT, 'public', 'locales');
const CACHE_FILE = path.join(ROOT, 'scripts', '.business-category-translation-cache.json');
const CATEGORIES_FILE = path.join(ROOT, 'utils', 'businessCategories.ts');

const EXTRA_KEYS = ['Select a category', 'Choose business category', 'Subcategory', 'Business Category'];

/** MyMemory langpair target codes (best-effort for Hanar locale files). */
const LANG_PAIR = {
  am: 'am',
  ar: 'ar',
  az: 'az',
  bn: 'bn',
  de: 'de',
  el: 'el',
  en: 'en',
  es: 'es',
  fa: 'fa',
  fr: 'fr',
  ha: 'ha',
  he: 'he',
  hi: 'hi',
  hy: 'hy',
  id: 'id',
  it: 'it',
  ja: 'ja',
  ka: 'ka',
  kk: 'kk',
  ko: 'ko',
  ku: 'ku',
  ms: 'ms',
  my: 'my',
  ne: 'ne',
  pa: 'pa',
  pl: 'pl',
  ps: 'ps',
  pt: 'pt',
  ro: 'ro',
  ru: 'ru',
  so: 'so',
  sw: 'sw',
  ta: 'ta',
  th: 'th',
  tr: 'tr',
  ug: 'ug',
  uk: 'uk',
  ur: 'ur',
  uz: 'uz',
  vi: 'vi',
  zh: 'zh-CN',
};

function extractCategoryKeys() {
  const source = fs.readFileSync(CATEGORIES_FILE, 'utf8');
  const labels = [...source.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  return [...new Set([...labels, ...EXTRA_KEYS])].sort((a, b) => a.localeCompare(b));
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateText(text, targetLang) {
  if (targetLang === 'en') return text;

  const pairLang = LANG_PAIR[targetLang] || targetLang;
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', `en|${pairLang}`);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(url.toString());
      const data = await res.json();
      const translated = String(data?.responseData?.translatedText || '').trim();
      if (translated && translated.toUpperCase() !== text.toUpperCase()) {
        return translated;
      }
      if (translated) return translated;
    } catch {
      // retry
    }
    await sleep(800 * (attempt + 1));
  }
  return text;
}

async function main() {
  const keys = extractCategoryKeys();
  const cache = loadCache();
  const localeFiles = fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));

  console.log(`Category keys: ${keys.length}, locale files: ${localeFiles.length}`);

  for (const file of localeFiles) {
    const lang = file.replace(/\.json$/, '');
    const filePath = path.join(LOCALES_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let added = 0;

    for (const key of keys) {
      const existing = data[key];
      if (existing && String(existing).trim()) continue;

      const cacheKey = `${lang}::${key}`;
      let value = cache[cacheKey];

      if (!value) {
        value = lang === 'en' ? key : await translateText(key, lang);
        cache[cacheKey] = value;
        saveCache(cache);
        await sleep(350);
      }

      data[key] = value;
      added += 1;
    }

    const sorted = Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(filePath, `${JSON.stringify(sorted, null, 2)}\n`);
    console.log(`Updated ${file} (+${added} keys)`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
