/**
 * Optional Firebase Admin for sending FCM push notifications.
 * Set FIREBASE_SERVICE_ACCOUNT_JSON (full JSON string) to enable.
 */

let messaging: import('firebase-admin').messaging.Messaging | null = null;

function getMessaging(): import('firebase-admin').messaging.Messaging | null {
  if (messaging !== undefined) return messaging;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json || typeof json !== 'string') {
    messaging = null;
    return null;
  }
  try {
    const credential = JSON.parse(json);
    if (!credential.project_id || !credential.private_key || !credential.client_email) {
      messaging = null;
      return null;
    }
    const admin = require('firebase-admin') as typeof import('firebase-admin');
    if (!admin.apps?.length) {
      admin.initializeApp({ credential: admin.credential.cert(credential) });
    }
    messaging = admin.messaging();
  } catch {
    messaging = null;
  }
  return messaging;
}

export function isPushConfigured(): boolean {
  return getMessaging() != null;
}

/**
 * Send FCM notification to up to 500 tokens per call. Returns { successCount, failureCount }.
 */
export async function sendPushToTokens(
  title: string,
  body: string,
  url: string | null,
  tokens: string[]
): Promise<{ successCount: number; failureCount: number }> {
  const m = getMessaging();
  if (!m || !tokens.length) {
    return { successCount: 0, failureCount: tokens.length ? tokens.length : 0 };
  }
  const data: Record<string, string> = {};
  if (url) data.url = url;
  const batchSize = 500;
  let successCount = 0;
  let failureCount = 0;
  for (let i = 0; i < tokens.length; i += batchSize) {
    const chunk = tokens.slice(i, i + batchSize);
    const result = await m.sendEachForMulticast({
      notification: { title, body },
      data,
      tokens: chunk,
    });
    successCount += result.successCount;
    failureCount += result.failureCount;
  }
  return { successCount, failureCount };
}
