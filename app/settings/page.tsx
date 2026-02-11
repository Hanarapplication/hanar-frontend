'use client';

import { useDarkMode } from '@/context/DarkModeContext';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SettingsPage() {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { effectiveLang } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.replace('/login');
    };
    check();
  }, [router]);

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-6">{t(effectiveLang, 'Settings')}</h1>

      {/* Dark Mode Toggle */}
      <div className="mb-6 flex items-center justify-between">
        <span className="font-medium text-gray-700 dark:text-gray-200">🌙 {t(effectiveLang, 'Dark mode')}</span>
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={darkMode}
            onChange={toggleDarkMode}
            className="sr-only"
          />
          <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full shadow-inner relative transition">
            <div
              className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
                darkMode ? 'translate-x-5' : ''
              }`}
            />
          </div>
        </label>
      </div>
    </div>
  );
}
