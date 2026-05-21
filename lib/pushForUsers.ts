/**
 * Resolve FCM device tokens and send push for one or more users.
 * Used for lock-screen / background delivery when FIREBASE_SERVICE_ACCOUNT_JSON is set.
 *
 * Token stores (both keyed by `user_id` + `token` text column):
 * - `public.user_push_tokens` — native app / Flutter WebView (`FcmTokenHandler` → POST /api/push/register-token)
 * - `public.push_tokens` — web PWA FCM tokens
 */

import { createClient } from '@supabase/supabase-js';
import {
  isPushConfigured,
  sendPushToTokensBuilt,
  type HanarPushBuilt,
  type FcmSendResult,
  type PushFcmExtras,
} from '@/lib/firebaseAdmin';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type PushPreferenceRow = { user_id: string; push_notifications_enabled: boolean | null };

/** Skip users who turned off push in Settings. Missing rows default to enabled. */
export async function filterPushEnabledUserIds(userIds: string[]): Promise<string[]> {
  const ids = Array.from(new Set(userIds.map((id) => String(id || '').trim()).filter(Boolean)));
  if (ids.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('registeredaccounts')
    .select('user_id, push_notifications_enabled')
    .in('user_id', ids);

  if (error) {
    console.warn('[push] filterPushEnabledUserIds: query failed — sending to all requested ids', error.message);
    return ids;
  }

  const disabled = new Set(
    ((data ?? []) as PushPreferenceRow[])
      .filter((row) => row.push_notifications_enabled === false)
      .map((row) => row.user_id),
  );

  const allowed = ids.filter((id) => !disabled.has(id));
  if (allowed.length < ids.length) {
    console.log('[push] filterPushEnabledUserIds: skipped users with push disabled', {
      requested: ids.length,
      allowed: allowed.length,
    });
  }
  return allowed;
}

export async function isPushEnabledForUser(userId: string): Promise<boolean> {
  const allowed = await filterPushEnabledUserIds([userId]);
  return allowed.length > 0;
}

type UserPushTokenRow = { token: string; updated_at: string };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * DM (and other) pushes: every FCM registration id saved for the recipient in the last 30 days —
 * `user_push_tokens` (Flutter / WebView via `/api/push/register-token`) and `push_tokens` (web PWA).
 * Invalid tokens are removed from both tables.
 */
export async function sendDmNativePushToRecipient(
  recipientUserId: string,
  push: HanarPushBuilt,
): Promise<{
  tokenCount: number;
  latestTokenUpdatedAt: string | null;
  result: FcmSendResult;
}> {
  const emptyResult: FcmSendResult = {
    successCount: 0,
    failureCount: 0,
    invalidTokens: [],
    errors: [],
  };

  const rid = String(recipientUserId || '').trim();
  if (!rid) {
    return { tokenCount: 0, latestTokenUpdatedAt: null, result: emptyResult };
  }

  const pushAllowed = await filterPushEnabledUserIds([rid]);
  if (pushAllowed.length === 0) {
    console.log('[push] sendDmNativePushToRecipient: recipient has push disabled — skipping', { recipientUserId: rid });
    return { tokenCount: 0, latestTokenUpdatedAt: null, result: emptyResult };
  }

  if (!isPushConfigured()) {
    console.warn('[push] sendDmNativePushToRecipient: Firebase Admin not configured — skipping', {
      recipientUserId: rid,
    });
    return { tokenCount: 0, latestTokenUpdatedAt: null, result: emptyResult };
  }

  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
  const [appRes, webRes] = await Promise.all([
    supabaseAdmin
      .from('user_push_tokens')
      .select('token, updated_at')
      .eq('user_id', rid)
      .gte('updated_at', cutoff),
    supabaseAdmin
      .from('push_tokens')
      .select('token, updated_at')
      .eq('user_id', rid)
      .gte('updated_at', cutoff),
  ]);

  if (appRes.error) {
    console.warn('[push] sendDmNativePushToRecipient: user_push_tokens select error', {
      message: appRes.error.message,
      code: appRes.error.code,
      recipientUserId: rid,
    });
  }
  if (webRes.error) {
    console.warn('[push] sendDmNativePushToRecipient: push_tokens select error', {
      message: webRes.error.message,
      code: webRes.error.code,
      recipientUserId: rid,
    });
  }

  const webRows = (webRes.error ? [] : (webRes.data ?? [])) as UserPushTokenRow[];
  const list: UserPushTokenRow[] = [
    ...((appRes.data || []) as UserPushTokenRow[]),
    ...webRows,
  ];

  const tokens = Array.from(new Set(list.map((r) => String(r.token || '').trim()).filter(Boolean)));

  let latestTokenUpdatedAt: string | null = null;
  for (const r of list) {
    const u = r.updated_at;
    if (!u) continue;
    if (!latestTokenUpdatedAt || u > latestTokenUpdatedAt) latestTokenUpdatedAt = u;
  }

  if (tokens.length === 0) {
    return { tokenCount: 0, latestTokenUpdatedAt, result: emptyResult };
  }

  const result = await sendPushToTokensBuilt(push, tokens);

  if (result.invalidTokens.length > 0) {
    await deleteInvalidFcmTokensFromStores(result.invalidTokens);
  }

  return { tokenCount: tokens.length, latestTokenUpdatedAt, result };
}

type AppTokenRow = { id?: string; user_id: string; token: string; platform?: string | null };
type WebTokenRow = { id?: string; user_id: string; token: string; platform?: string | null };

/** Safe for logs (never log full FCM registration ids). */
function redactFcmToken(token: string): string {
  const t = String(token ?? '').trim();
  if (!t) return '(empty)';
  if (t.length <= 14) return `(${t.length} chars)`;
  return `${t.slice(0, 6)}…${t.slice(-4)} len=${t.length}`;
}

async function resolveRecipientFcmRows(userIds: string[]): Promise<{
  recipientUserIds: string[];
  appRows: AppTokenRow[];
  webRows: WebTokenRow[];
  distinctTokens: string[];
}> {
  const recipientUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (recipientUserIds.length === 0) {
    return { recipientUserIds, appRows: [], webRows: [], distinctTokens: [] };
  }

  const [appRes, webRes] = await Promise.all([
    supabaseAdmin
      .from('user_push_tokens')
      .select('id, user_id, token, platform')
      .in('user_id', recipientUserIds),
    supabaseAdmin
      .from('push_tokens')
      .select('id, user_id, token, platform')
      .in('user_id', recipientUserIds),
  ]);

  if (appRes.error) {
    console.warn('[push] user_push_tokens select error', appRes.error.message, appRes.error.code);
  }
  if (webRes.error) {
    console.warn('[push] push_tokens select error', webRes.error.message, webRes.error.code);
  }

  const appRows = (appRes.data || []) as AppTokenRow[];
  const webRows = webRes.error ? [] : ((webRes.data || []) as WebTokenRow[]);

  const fromApp = appRows.map((r) => r.token).filter(Boolean);
  const fromWeb = webRows.map((r) => r.token).filter(Boolean);
  const distinctTokens = Array.from(new Set([...fromApp, ...fromWeb]));

  return { recipientUserIds, appRows, webRows, distinctTokens };
}

/** Deletes stale registration ids from both native and web token tables (same `token` column). */
async function deleteInvalidFcmTokensFromStores(tokens: string[]): Promise<void> {
  const unique = Array.from(new Set(tokens.map((t) => String(t).trim()).filter(Boolean)));
  if (unique.length === 0) return;

  const [appDel, webDel] = await Promise.all([
    supabaseAdmin.from('user_push_tokens').delete().in('token', unique),
    supabaseAdmin.from('push_tokens').delete().in('token', unique),
  ]);

  if (appDel.error) {
    console.warn('[push] user_push_tokens delete (invalid token) error', appDel.error.message);
  }
  if (webDel.error) {
    console.warn('[push] push_tokens delete (invalid token) error', webDel.error.message);
  }

  console.log('[push] removed invalid FCM tokens from DB', {
    requestedDeleteCount: unique.length,
    userPushTokensError: appDel.error?.message,
    pushTokensError: webDel.error?.message,
  });
}

export async function getPushTokensForUserIds(userIds: string[]): Promise<string[]> {
  const { distinctTokens } = await resolveRecipientFcmRows(userIds);
  return distinctTokens;
}

export async function getPushTokensForUser(userId: string): Promise<string[]> {
  return getPushTokensForUserIds([userId]);
}

/**
 * Send the same FCM notification to all devices for the given user ids.
 * Prefer passing a {@link HanarPushBuilt} from a `build*PushContent` helper.
 */
export async function sendPushToUserIds(userIds: string[], push: HanarPushBuilt): Promise<{
  successCount: number;
  failureCount: number;
}>;
export async function sendPushToUserIds(
  userIds: string[],
  title: string,
  body: string,
  url: string | null,
  fcmExtras?: PushFcmExtras
): Promise<{ successCount: number; failureCount: number }>;
export async function sendPushToUserIds(
  userIds: string[],
  titleOrPush: string | HanarPushBuilt,
  body?: string,
  url?: string | null,
  fcmExtras?: PushFcmExtras
): Promise<{ successCount: number; failureCount: number }> {
  const requestedRecipientIds = Array.from(new Set(userIds.filter(Boolean)));
  console.log('[push] sendPushToUserIds: requested recipient user ids', requestedRecipientIds);

  if (requestedRecipientIds.length === 0) {
    console.log('[push] sendPushToUserIds: no recipient ids after filter — skipping');
    return { successCount: 0, failureCount: 0 };
  }

  const recipientUserIds = await filterPushEnabledUserIds(requestedRecipientIds);
  if (recipientUserIds.length === 0) {
    console.log('[push] sendPushToUserIds: all recipients have push disabled — skipping');
    return { successCount: 0, failureCount: 0 };
  }

  if (!isPushConfigured()) {
    console.warn('[push] sendPushToUserIds: Firebase Admin not configured — skipping send', {
      requestedRecipientIds: recipientUserIds,
    });
    return { successCount: 0, failureCount: 0 };
  }

  const { appRows, webRows, distinctTokens } = await resolveRecipientFcmRows(recipientUserIds);

  const appRowLog = appRows.map((r) => ({
    table: 'user_push_tokens',
    id: r.id,
    user_id: r.user_id,
    platform: r.platform ?? null,
    token: redactFcmToken(r.token),
  }));
  const webRowLog = webRows.map((r) => ({
    table: 'push_tokens',
    id: r.id,
    user_id: r.user_id,
    platform: r.platform ?? null,
    token: redactFcmToken(r.token),
  }));

  console.log('[push] sendPushToUserIds: DB rows for recipients (token redacted)', {
    queriedUserIds: recipientUserIds,
    user_push_tokens_row_count: appRows.length,
    push_tokens_row_count: webRows.length,
    distinct_token_count: distinctTokens.length,
    user_push_tokens_rows: appRowLog,
    push_tokens_rows: webRowLog,
  });

  if (distinctTokens.length === 0) {
    console.warn('[push] sendPushToUserIds: zero FCM tokens for recipients — nothing to send', {
      requestedRecipientIds,
    });
    return { successCount: 0, failureCount: 0 };
  }

  const push: HanarPushBuilt =
    typeof titleOrPush === 'object'
      ? titleOrPush
      : {
          title: titleOrPush,
          body: body ?? '',
          linkPath: url ?? null,
          type: fcmExtras?.type ?? 'hanar',
          senderId:
            fcmExtras?.senderId != null && String(fcmExtras.senderId).trim()
              ? String(fcmExtras.senderId).trim()
              : undefined,
        };

  const fcmResult = await sendPushToTokensBuilt(push, distinctTokens);

  console.log('[push] sendPushToUserIds: Firebase send result', {
    requestedRecipientIds,
    distinct_token_count: distinctTokens.length,
    successCount: fcmResult.successCount,
    failureCount: fcmResult.failureCount,
    invalidTokenCount: fcmResult.invalidTokens.length,
  });

  if (fcmResult.invalidTokens.length > 0) {
    await deleteInvalidFcmTokensFromStores(fcmResult.invalidTokens);
  }

  return {
    successCount: fcmResult.successCount,
    failureCount: fcmResult.failureCount,
  };
}
