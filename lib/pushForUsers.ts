/**
 * Resolve FCM device tokens and send push for one or more users.
 * Used for lock-screen / background delivery when FIREBASE_SERVICE_ACCOUNT_JSON is set.
 * Tokens come from `user_push_tokens` (e.g. Flutter WebView) and `push_tokens` (web PWA).
 */

import { createClient } from '@supabase/supabase-js';
import { isPushConfigured, sendPushToTokens } from '@/lib/firebaseAdmin';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export async function getPushTokensForUserIds(userIds: string[]): Promise<string[]> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return [];
  const [appRes, webRes] = await Promise.all([
    supabaseAdmin.from('user_push_tokens').select('token').in('user_id', unique),
    supabaseAdmin.from('push_tokens').select('token').in('user_id', unique),
  ]);
  const appTokens = (appRes.data || []).map((r: { token: string }) => r.token).filter(Boolean);
  const webTokens = webRes.error ? [] : (webRes.data || []).map((r: { token: string }) => r.token).filter(Boolean);
  return Array.from(new Set([...appTokens, ...webTokens]));
}

export async function getPushTokensForUser(userId: string): Promise<string[]> {
  return getPushTokensForUserIds([userId]);
}

/**
 * Send the same FCM notification to all devices for the given user ids.
 */
export async function sendPushToUserIds(
  userIds: string[],
  title: string,
  body: string,
  url: string | null
): Promise<{ successCount: number; failureCount: number }> {
  if (!isPushConfigured() || userIds.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }
  const tokens = await getPushTokensForUserIds(userIds);
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }
  return sendPushToTokens(title, body, url, tokens);
}
