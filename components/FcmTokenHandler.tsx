/**
 * Bridge for **native** Hanar apps (iOS / Android) that use a WebView.
 * Web FCM (service worker + VAPID) usually does not work inside in-app WebViews; the shell
 * should obtain a device token with Firebase/APNs and call
 * `window.HanarApp.onToken(token, 'ios' | 'android')` after the user allows notifications.
 * The second argument defaults to `'android'` when omitted (legacy callers).
 *
 * Tokens are stored on the logged-in user via `POST /api/push/register-token` (Bearer session).
 * A pure Flutter shell (no WebView) should call that same endpoint after login with the
 * Supabase access token and `{ "token": "<fcm>", "platform": "ios" | "android" }`.
 */
'use client';

import { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

export type HanarNativePushPlatform = 'ios' | 'android';

const PENDING_NATIVE_FCM_KEY = 'hanar_pending_native_fcm_v1';

type PendingNativeFcm = { token: string; platform: HanarNativePushPlatform };

function resolveNativePlatform(platform: unknown): HanarNativePushPlatform {
  return platform === 'ios' || platform === 'android' ? platform : 'android';
}

function readPendingNativeFcm(): PendingNativeFcm | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_NATIVE_FCM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; platform?: string };
    const t = typeof parsed.token === 'string' ? parsed.token.trim() : '';
    if (!t) return null;
    const platform = resolveNativePlatform(parsed.platform);
    return { token: t, platform };
  } catch {
    return null;
  }
}

function writePendingNativeFcm(pending: PendingNativeFcm): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(PENDING_NATIVE_FCM_KEY, JSON.stringify(pending));
  } catch {
    /* quota / private mode */
  }
}

function clearPendingNativeFcm(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PENDING_NATIVE_FCM_KEY);
  } catch {
    /* ignore */
  }
}

async function postRegisterNativeToken(
  accessToken: string,
  token: string,
  platform: HanarNativePushPlatform,
): Promise<Response> {
  return fetch('/api/push/register-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
    body: JSON.stringify({ token, platform }),
  });
}

/** Persist native FCM token when session is ready; clears queued token on success. */
export async function flushPendingNativePushToken(session?: Session | null): Promise<void> {
  const pending = readPendingNativeFcm();
  if (!pending) return;

  const s =
    session ??
    (
      await supabase.auth.getSession()
    ).data.session;
  if (!s?.access_token) return;

  try {
    const res = await postRegisterNativeToken(s.access_token, pending.token, pending.platform);
    if (res.ok) {
      clearPendingNativeFcm();
      console.log('[HanarApp.onToken] Flushed queued native FCM token for user', s.user.id);
      return;
    }
    const detail = await res.text().catch(() => '');
    console.warn('[HanarApp.onToken] Queued register-token failed', res.status, detail);
    if (res.status === 401 || res.status >= 500) {
      /* keep pending for TOKEN_REFRESHED / retry after server recovery */
    } else {
      clearPendingNativeFcm();
    }
  } catch (err) {
    console.warn('[HanarApp.onToken] flush pending error:', err);
  }
}

declare global {
  interface Window {
    HanarApp?: {
      onToken?: (token: string, platform?: HanarNativePushPlatform) => Promise<void>;
    };
  }
}

export default function FcmTokenHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.HanarApp = window.HanarApp || {};
    window.HanarApp.onToken = async (token: string, platform?: HanarNativePushPlatform) => {
      try {
        const nativePlatform = resolveNativePlatform(platform);
        const trimmed = String(token || '').trim();
        if (!trimmed) return;

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) {
          console.warn('[HanarApp.onToken] getSession error:', sessionError.message);
          writePendingNativeFcm({ token: trimmed, platform: nativePlatform });
          return;
        }
        if (!session?.user || !session.access_token) {
          writePendingNativeFcm({ token: trimmed, platform: nativePlatform });
          console.warn('[HanarApp.onToken] No session yet; native FCM token queued for after login');
          return;
        }
        const res = await postRegisterNativeToken(session.access_token, trimmed, nativePlatform);
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          console.warn('[HanarApp.onToken] register-token failed', res.status, detail);
          if (res.status === 401 || res.status >= 500) {
            writePendingNativeFcm({ token: trimmed, platform: nativePlatform });
          }
          return;
        }
        clearPendingNativeFcm();
        console.log('[HanarApp.onToken] Token saved for user', session.user.id);
      } catch (err) {
        console.warn('[HanarApp.onToken] Error:', err);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, authSession) => {
      if (
        authSession?.access_token &&
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')
      ) {
        void flushPendingNativePushToken(authSession);
      }
      if (event === 'SIGNED_OUT') {
        clearPendingNativeFcm();
      }
    });

    void flushPendingNativePushToken();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
