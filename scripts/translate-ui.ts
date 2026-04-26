import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import translations from '../utils/translations';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'locales');

type TranslationMap = Record<string, string>;

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const english = (translations as Record<string, TranslationMap>).en || {};
  const keys = Object.keys(english);
  if (!keys.length) {
    console.log('No base English UI keys found.');
    return;
  }

  await fs.writeFile(path.join(OUTPUT_DIR, 'en.json'), JSON.stringify(english, null, 2), 'utf8');
  const languages = Object.keys(translations).filter((code) => code !== 'en');

  for (const lang of languages) {
    const existing = ((translations as Record<string, TranslationMap>)[lang] || {}) as TranslationMap;
    let existingLocaleFile: TranslationMap = {};
    const localePath = path.join(OUTPUT_DIR, `${lang}.json`);
    try {
      const existingRaw = await fs.readFile(localePath, 'utf8');
      existingLocaleFile = JSON.parse(existingRaw) as TranslationMap;
    } catch {
      existingLocaleFile = {};
    }
    const output: TranslationMap = {};

    keys.forEach((key) => {
      const value = existingLocaleFile[key] || existing[key];
      if (value && value.trim()) {
        output[key] = value;
      } else {
        output[key] = english[key] || key;
      }
    });

    await fs.writeFile(path.join(OUTPUT_DIR, `${lang}.json`), JSON.stringify(output, null, 2), 'utf8');
    console.log(`Wrote locales/${lang}.json`);
  }
  console.log('[translate:ui] Synced locale JSON files from existing project translations/locales.');
}

main().catch((error) => {
  console.error('translate:ui failed', error);
  process.exit(1);
});
