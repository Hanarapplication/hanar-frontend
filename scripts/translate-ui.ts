import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { Translate } from '@google-cloud/translate/build/src/v2';
import translations from '../utils/translations';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const MAX_SEGMENTS_PER_REQUEST = 100;
const HANAR_SPLIT_REGEX = /(hanar)/gi;
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'locales');

type TranslationMap = Record<string, string>;

function splitBrandSegments(text: string): Array<{ value: string; isBrand: boolean }> {
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

function createTranslateClient(): Translate | null {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const inlineJson = process.env.GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!projectId) return null;
  if (!inlineJson && !credentialsPath) return null;

  if (inlineJson) {
    const credentials = JSON.parse(inlineJson);
    return new Translate({ projectId, credentials });
  }
  return new Translate({ projectId });
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const english = (translations as Record<string, TranslationMap>).en || {};
  const keys = Object.keys(english);
  if (!keys.length) {
    console.log('No base English UI keys found.');
    return;
  }

  await fs.writeFile(path.join(OUTPUT_DIR, 'en.json'), JSON.stringify(english, null, 2), 'utf8');

  const client = createTranslateClient();
  if (client) {
    console.log('Google Translate enabled for translate:ui');
  } else {
    console.log('Google Translate disabled (missing env). Writing fallback locale files from existing translations.');
  }
  const languages = Object.keys(translations).filter((code) => code !== 'en');

  for (const lang of languages) {
    const existing = ((translations as Record<string, TranslationMap>)[lang] || {}) as TranslationMap;
    const output: TranslationMap = {};
    const missingValues: string[] = [];
    const missingKeys: string[] = [];

    keys.forEach((key) => {
      const value = existing[key];
      if (value && value.trim()) {
        output[key] = value;
      } else {
        missingKeys.push(key);
        missingValues.push(english[key] || key);
      }
    });

    if (client) {
      for (let start = 0; start < missingValues.length; start += MAX_SEGMENTS_PER_REQUEST) {
        const end = start + MAX_SEGMENTS_PER_REQUEST;
        const chunk = missingValues.slice(start, end);
        const keyChunk = missingKeys.slice(start, end);
        const translated = await translatePreservingBrand(client, chunk, lang);
        keyChunk.forEach((key, index) => {
          output[key] = translated[index] || english[key] || key;
        });
      }
    } else {
      missingKeys.forEach((key) => {
        output[key] = english[key] || key;
      });
    }

    await fs.writeFile(path.join(OUTPUT_DIR, `${lang}.json`), JSON.stringify(output, null, 2), 'utf8');
    console.log(`Wrote locales/${lang}.json`);
  }
}

main().catch((error) => {
  console.error('translate:ui failed', error);
  process.exit(1);
});
