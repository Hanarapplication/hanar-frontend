import { v3 } from '@google-cloud/translate';
import { Translate as TranslateV2 } from '@google-cloud/translate/build/src/v2';

const { TranslationServiceClient } = v3;

/**
 * Translates post content using Google Cloud Translation API v3.
 *
 * Auth is handled by GOOGLE_APPLICATION_CREDENTIALS on the server.
 */
export async function translatePost(content, sourceLang, targetLang) {
  const text = String(content || '').trim();
  if (!text) return '';

  const src = String(sourceLang || '').trim().toLowerCase();
  const target = String(targetLang || '').trim().toLowerCase();
  if (!target) throw new Error('Missing target language');
  if (src && src === target) return text;

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (!projectId) {
    throw new Error('Missing GOOGLE_CLOUD_PROJECT_ID for Translation API v3');
  }

  const parent = `projects/${projectId}/locations/global`;

  // Prefer v3, but fall back to v2 if v3 API is not enabled.
  try {
    const client = new TranslationServiceClient();
    const [response] = await client.translateText({
      parent,
      contents: [text],
      mimeType: 'text/plain',
      sourceLanguageCode: src || undefined,
      targetLanguageCode: target,
    });
    return response?.translations?.[0]?.translatedText || text;
  } catch (v3Error) {
    const fallbackClient = new TranslateV2({ projectId });
    const [translated] = await fallbackClient.translate(text, { from: src || undefined, to: target });
    return String(translated || text);
  }
}

export default translatePost;
