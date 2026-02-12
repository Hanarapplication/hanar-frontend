'use client';

import { usePushNotifications, type PushStatus } from '@/hooks/usePushNotifications';
import { Bell, BellOff } from 'lucide-react';

function statusMessage(status: PushStatus): string {
  switch (status) {
    case 'unsupported':
      return 'Push notifications are not supported in this browser.';
    case 'not-supported':
      return 'Push is not configured for this site.';
    case 'permission-denied':
      return 'Notifications were blocked. Enable them in your browser settings (e.g. site info / Permissions) and refresh.';
    case 'disabled':
      return 'Enable push to receive notifications when the app is in the background.';
    case 'enabled':
      return 'Push notifications are on.';
    case 'login-required':
      return 'Log in to enable push notifications.';
    case 'error':
      return 'Something went wrong. Try again or check your browser settings.';
    case 'loading':
    default:
      return '';
  }
}

export default function PushNotificationToggle() {
  const { supported, status, error, enablePush } = usePushNotifications();
  const message = statusMessage(status);
  const showButton = status === 'disabled' || status === 'login-required' || status === 'error';
  const isEnabled = status === 'enabled';
  const isLoading = status === 'loading';

  if (!supported && status !== 'loading') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4">
        <p className="text-sm text-amber-800 dark:text-amber-200">{message}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
          {isEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-slate-900 dark:text-gray-100">Push notifications</h3>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-400">
            {message}
            {error && (
              <span className="mt-1 block text-red-600 dark:text-red-400">{error}</span>
            )}
          </p>
          {showButton && (
            <button
              type="button"
              onClick={enablePush}
              disabled={isLoading}
              className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Enabling…' : 'Enable push notifications'}
            </button>
          )}
          {isEnabled && (
            <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">You will receive push notifications.</p>
          )}
        </div>
      </div>
    </div>
  );
}
