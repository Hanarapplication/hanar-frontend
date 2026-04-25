import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Translate } from '@google-cloud/translate/build/src/v2';
import translations from '../utils/translations';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

/**
 * This script uses paid Google Translate API. Run manually only.
 */
const MAX_SEGMENTS_PER_REQUEST = 100;
const HANAR_SPLIT_REGEX = /(hanar)/gi;
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'locales');
const MAX_CHARS_PER_RUN = Number(process.env.TRANSLATE_UI_MAX_CHARS_PER_RUN || 10000);
const TRANSLATION_ENABLED = String(process.env.TRANSLATION_ENABLED || 'false').toLowerCase() === 'true';

type TranslationMap = Record<string, string>;

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

async function logUsage(payload: {
  endpointName: string;
  sourceLanguage?: string | null;
  targetLanguage?: string | null;
  characterCount?: number;
  textPreview?: string;
  cacheHit?: boolean;
  reason?: string;
  paidCall?: boolean;
  blocked?: boolean;
}) {
  try {
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) return;
    const { error } = await supabaseAdmin.from('translation_usage_logs').insert({
      endpoint_name: payload.endpointName,
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
      console.error('[translate:ui] usage log error', error);
    }
  } catch (error) {
    console.error('[translate:ui] usage log unexpected error', error);
  }
}

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

  const client = TRANSLATION_ENABLED ? createTranslateClient() : null;
  if (!TRANSLATION_ENABLED) {
    console.log('TRANSLATION_ENABLED is false. Script will not call paid Google Translate and will only write existing/default labels.');
    await logUsage({
      endpointName: 'scripts/translate-ui',
      sourceLanguage: 'en',
      targetLanguage: null,
      characterCount: 0,
      textPreview: '',
      cacheHit: false,
      reason: 'disabled by TRANSLATION_ENABLED',
      paidCall: false,
      blocked: true,
    });
  }
  if (client) {
    console.log('Google Translate enabled for translate:ui');
  } else {
    console.log('Google Translate disabled (missing env). Writing fallback locale files from existing translations.');
  }
  const languages = Object.keys(translations).filter((code) => code !== 'en');
  let translatedCharsThisRun = 0;
  let limitReached = false;

  for (const lang of languages) {
    if (limitReached) break;
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
    const missingValues: string[] = [];
    const missingKeys: string[] = [];

    keys.forEach((key) => {
      const value = existingLocaleFile[key] || existing[key];
      if (value && value.trim()) {
        output[key] = value;
      } else {
        const source = english[key] || key;
        const nextChars = translatedCharsThisRun + source.length;
        if (nextChars > MAX_CHARS_PER_RUN) {
          limitReached = true;
          void logUsage({
            endpointName: 'scripts/translate-ui',
            sourceLanguage: 'en',
            targetLanguage: lang,
            characterCount: source.length,
            textPreview: source,
            cacheHit: false,
            reason: 'daily limit reached',
            paidCall: false,
            blocked: true,
          });
          return;
        }
        missingKeys.push(key);
        missingValues.push(source);
        translatedCharsThisRun += source.length;
      }
    });

    if (client) {
      for (let start = 0; start < missingValues.length; start += MAX_SEGMENTS_PER_REQUEST) {
        const end = start + MAX_SEGMENTS_PER_REQUEST;
        const chunk = missingValues.slice(start, end);
        const keyChunk = missingKeys.slice(start, end);
        await logUsage({
          endpointName: 'scripts/translate-ui',
          sourceLanguage: 'en',
          targetLanguage: lang,
          characterCount: chunk.reduce((sum, value) => sum + value.length, 0),
          textPreview: chunk[0] || '',
          cacheHit: false,
          reason: 'manual script translation generation',
          paidCall: true,
          blocked: false,
        });
        const translated = await translatePreservingBrand(client, chunk, lang);
        keyChunk.forEach((key, index) => {
          output[key] = translated[index] || english[key] || key;
        });
        const chunkChars = chunk.reduce((sum, value) => sum + value.length, 0);
        console.log(`[translate:ui] lang=${lang} translated_chunk_chars=${chunkChars}`);
      }
    } else {
      missingKeys.forEach((key) => {
        output[key] = english[key] || key;
      });
    }

    await fs.writeFile(path.join(OUTPUT_DIR, `${lang}.json`), JSON.stringify(output, null, 2), 'utf8');
    console.log(`Wrote locales/${lang}.json`);
    if (limitReached) {
      console.warn(
        `[translate:ui] Character limit reached (${MAX_CHARS_PER_RUN}). Stopping safely after ${lang}.`
      );
    }
  }
  console.log(`[translate:ui] Total translated characters this run: ${translatedCharsThisRun}`);
}

main().catch((error) => {
  console.error('translate:ui failed', error);
  process.exit(1);
});
