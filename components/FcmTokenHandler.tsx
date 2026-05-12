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
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) {
          console.warn('[HanarApp.onToken] getUser error:', userError.message);
          return;
        }
        if (!user) {
          console.warn('[HanarApp.onToken] No user, skip saving token');
          return;
        }
        const { error } = await supabase.from('user_push_tokens').upsert(
          {
            user_id: user.id,
            token,
            platform: nativePlatform,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'token' }
        );
        if (error) {
          console.warn('[HanarApp.onToken] upsert error:', error.message);
          return;
        }
        console.log('[HanarApp.onToken] Token saved');
      } catch (err) {
        console.warn('[HanarApp.onToken] Error:', err);
      }
    };
  }, []);

  return null;
}
