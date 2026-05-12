/**
 * Bridge for **native** Hanar apps (iOS / Android) that use a WebView.
 * Web FCM (service worker + VAPID) usually does not work inside in-app WebViews; the shell
 * should obtain a device token with Firebase/APNs and call
 * `window.HanarApp.onToken(token, 'ios' | 'android')` after the user allows notifications.
 * The second argument defaults to `'android'` when omitted (legacy callers).
 */
'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type HanarNativePushPlatform = 'ios' | 'android';

function resolveNativePlatform(platform: unknown): HanarNativePushPlatform {
  return platform === 'ios' || platform === 'android' ? platform : 'android';
}

declare global {
  interface Window {
    HanarApp?: {
      onToken?: (token: string, platform?: HanarNativePushPlatform) => Promise<void>;
    };
  }
}

export default function FcmTokenHandler() {
  const initialized = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || initialized.current) return;
    initialized.current = true;

    window.HanarApp = window.HanarApp || {};
    window.HanarApp.onToken = async (token: string, platform?: HanarNativePushPlatform) => {
      try {
        const nativePlatform = resolveNativePlatform(platform);
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) {
          console.warn('[HanarApp.onToken] getSession error:', sessionError.message);
          return;
        }
        if (!session?.user || !session.access_token) {
          console.warn('[HanarApp.onToken] No session, skip saving token');
          return;
        }
        const res = await fetch('/api/push/register-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          credentials: 'include',
          body: JSON.stringify({ token, platform: nativePlatform }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          console.warn('[HanarApp.onToken] register-token failed', res.status, detail);
          return;
        }
        console.log('[HanarApp.onToken] Token saved for user', session.user.id);
      } catch (err) {
        console.warn('[HanarApp.onToken] Error:', err);
      }
    };
  }, []);

  return null;
}
