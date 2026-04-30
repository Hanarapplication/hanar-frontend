'use client';

import { useState, useEffect, useCallback } from 'react';
import { getToken, isSupported, onMessage, type MessagePayload } from 'firebase/messaging';
import { getFirebaseMessaging, getVapidKey, isFirebaseConfigured } from '@/lib/firebaseClient';
import { upsertPushToken } from '@/lib/pushTokens';
import { supabase } from '@/lib/supabaseClient';

export type PushStatus =
  | 'unsupported'
  | 'not-supported'
  /** FCM + Web Push (Push API) not available: common inside system WebViews (e.g. iOS WKWebView) even when Notification + SW exist. */
  | 'fcm-unsupported'
  | 'permission-denied'
  | 'disabled'
  | 'enabled'
  | 'loading'
  | 'login-required'
  | 'error';

export type UsePushNotificationsResult = {
  supported: boolean;
  status: PushStatus;
  permission: NotificationPermission | null;
  token: string | null;
  error: string | null;
  enablePush: () => Promise<void>;
};

const SW_PATH = '/firebase-messaging-sw.js';

export function usePushNotifications(): UsePushNotificationsResult {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<PushStatus>('loading');
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    (async () => {
      if (!('Notification' in window)) {
        if (!cancelled) {
          setSupported(false);
          setStatus('unsupported');
          setPermission(null);
        }
        return;
      }
      if (!isFirebaseConfigured()) {
        if (!cancelled) {
          setSupported(false);
          setStatus('not-supported');
          setPermission(Notification.permission);
        }
        return;
      }
      const hasBaseApis = 'serviceWorker' in navigator;
      const fcmOk = hasBaseApis && (await isSupported());
      if (cancelled) return;
      if (!fcmOk) {
        setSupported(false);
        setStatus('fcm-unsupported');
        setPermission(Notification.permission);
        return;
      }
      setSupported(true);
      setPermission(Notification.permission);
      if (Notification.permission === 'denied') {
        setStatus('permission-denied');
        return;
      }
      if (Notification.permission === 'default') {
        setStatus('disabled');
        return;
      }
      if (Notification.permission === 'granted') {
        setStatus('enabled');
        setToken(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enablePush = useCallback(async () => {
    setError(null);
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setStatus('unsupported');
      return;
    }
    if (!isFirebaseConfigured()) {
      setStatus('not-supported');
      setError('Push is not configured for this site.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStatus('login-required');
      setError('Login required to enable push.');
      return;
    }

    setStatus('loading');
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== 'granted') {
        setStatus('permission-denied');
        setError(permissionResult === 'denied' ? 'Permission denied.' : 'Permission dismissed.');
        return;
      }

      const registration = await navigator.serviceWorker.register(SW_PATH, {
        scope: '/',
      });
      await navigator.serviceWorker.ready;

      const messaging = await getFirebaseMessaging();
      if (!messaging) {
        setStatus('error');
        setError('Messaging not available.');
        return;
      }

      const vapidKey = getVapidKey();
      if (!vapidKey) {
        setStatus('error');
        setError('VAPID key not configured.');
        return;
      }

      const currentToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });
      if (!currentToken) {
        setStatus('error');
        setError('Could not get FCM token.');
        return;
      }

      const result = await upsertPushToken(user.id, currentToken, {
        platform: 'web',
        device_info: { userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined },
      });
      if (!result.ok) {
        setStatus('error');
        setError(result.error || 'Failed to save token.');
        return;
      }

      setToken(currentToken);
      setStatus('enabled');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatus('error');
      setError(message);
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured() || status !== 'enabled') return;
    let unsubscribe: (() => void) | undefined;
    getFirebaseMessaging().then((messaging) => {
      if (!messaging) return;
      unsubscribe = onMessage(messaging, (payload: MessagePayload) => {
        const notification = payload.notification;
        const title = notification?.title || payload.data?.title || 'Hanar';
        const body = notification?.body || payload.data?.body || '';
        const options: NotificationOptions = {
          body: body || 'New notification',
          icon: notification?.icon || payload.data?.icon || '/hanar.logo.png',
          tag: payload.data?.tag || 'hanar-push',
          data: { url: payload.data?.url || '/' },
        };
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(title, options);
        }
      });
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [status]);

  return {
    supported,
    status,
    permission,
    token,
    error,
    enablePush,
  };
}
