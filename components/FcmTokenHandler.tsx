'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

declare global {
  interface Window {
    HanarApp?: {
      onToken?: (token: string) => Promise<void>;
    };
  }
}

export default function FcmTokenHandler() {
  const initialized = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || initialized.current) return;
    initialized.current = true;

    window.HanarApp = window.HanarApp || {};
    window.HanarApp.onToken = async (token: string) => {
      try {
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
            platform: 'android',
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
