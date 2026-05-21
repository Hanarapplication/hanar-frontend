'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabaseClient';
import { t } from '@/utils/translations';

export default function PushNotificationToggle() {
  const { effectiveLang } = useLanguage();
  const { supported, status, error, enablePush } = usePushNotifications();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [prefLoading, setPrefLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setPushEnabled(false);
          setPrefLoading(false);
        }
        return;
      }
      const { data, error: loadError } = await supabase
        .from('registeredaccounts')
        .select('push_notifications_enabled')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (loadError) {
        console.warn('[push] failed to load push_notifications_enabled', loadError.message);
        setPushEnabled(true);
      } else {
        setPushEnabled(data?.push_notifications_enabled !== false);
      }
      setPrefLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const savePreference = useCallback(async (enabled: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t(effectiveLang, 'Log in to change push notification settings.'));
      return false;
    }
    const { error: updateError } = await supabase
      .from('registeredaccounts')
      .update({ push_notifications_enabled: enabled })
      .eq('user_id', user.id);
    if (updateError) {
      toast.error(t(effectiveLang, 'Failed to save notification setting.'));
      return false;
    }
    return true;
  }, [effectiveLang]);

  const handleToggle = async () => {
    if (prefLoading || saving) return;
    const next = !pushEnabled;
    setSaving(true);
    try {
      if (next) {
        const saved = await savePreference(true);
        if (!saved) return;
        setPushEnabled(true);
        if (supported && status !== 'enabled' && status !== 'permission-denied') {
          await enablePush();
        }
        toast.success(t(effectiveLang, 'Push notifications turned on.'));
      } else {
        const saved = await savePreference(false);
        if (!saved) return;
        setPushEnabled(false);
        toast.success(t(effectiveLang, 'Push notifications turned off.'));
      }
    } finally {
      setSaving(false);
    }
  };

  const message = pushEnabled
    ? t(effectiveLang, 'Turn this off to stop receiving push notifications on your device.')
    : t(effectiveLang, 'You will no longer receive push notifications on your device.');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="font-medium text-gray-700 dark:text-gray-200">
            {t(effectiveLang, 'Push notifications')}
          </span>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
            {prefLoading ? t(effectiveLang, 'Loading...') : message}
          </p>
          {pushEnabled && error ? (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
        </div>
        <label className="inline-flex shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            checked={pushEnabled}
            onChange={handleToggle}
            disabled={prefLoading || saving}
            className="sr-only"
          />
          <div
            className={`relative h-6 w-11 rounded-full shadow-inner transition ${
              pushEnabled ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'
            } ${prefLoading || saving ? 'opacity-50' : ''}`}
          >
            <div
              className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                pushEnabled ? 'translate-x-5' : ''
              }`}
            />
          </div>
        </label>
      </div>

      {pushEnabled && supported && status === 'disabled' && !prefLoading && (
        <button
          type="button"
          onClick={async () => {
            setSaving(true);
            try {
              await enablePush();
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? t(effectiveLang, 'Enabling...') : t(effectiveLang, 'Allow notifications in browser')}
        </button>
      )}
    </div>
  );
}
