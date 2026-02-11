'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { t as tFromTranslations } from '@/utils/translations';
import { supabase } from '@/lib/supabaseClient';

const SUPPORTED_CODES = new Set([
  'en', 'am', 'ar', 'az', 'bn', 'de', 'el', 'es', 'fa', 'fr', 'ha', 'he', 'hi', 'hy', 'id', 'it', 'ja', 'ka', 'ku', 'ms', 'ne', 'pa', 'pl', 'ps', 'pt', 'ro', 'ru', 'so', 'ta', 'th', 'tr', 'ug', 'uk', 'ur', 'uz', 'vi', 'zh', 'ko', 'sw',
]);

function resolveEffectiveLang(lang: string): string {
  if (lang !== 'auto') return SUPPORTED_CODES.has(lang) ? lang : 'en';
  if (typeof navigator === 'undefined') return 'en';
  const browser = navigator.language.slice(0, 2).toLowerCase();
  return SUPPORTED_CODES.has(browser) ? browser : 'en';
}

type LanguageContextType = {
  lang: string;
  setLang: (lang: string) => void;
  /** Resolved language code used for t() - when lang is 'auto', uses browser language */
  effectiveLang: string;
};

const LanguageContext = createContext<LanguageContextType>({
  lang: 'auto',
  setLang: () => {},
  effectiveLang: 'en',
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState('auto');
  const [effectiveLang, setEffectiveLang] = useState('en');

  useEffect(() => {
    const savedLang = localStorage.getItem('hanarLang');
    if (savedLang) setLangState(savedLang);
  }, []);

  useEffect(() => {
    let mounted = true;
    const syncFromDb = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      const { data } = await supabase
        .from('registeredaccounts')
        .select('preferred_language')
        .eq('user_id', user.id)
        .maybeSingle();
      const dbLang = (data as { preferred_language?: string | null } | null)?.preferred_language;
      if (dbLang && typeof dbLang === 'string' && dbLang.trim()) {
        setLangState(dbLang.trim());
        localStorage.setItem('hanarLang', dbLang.trim());
      }
    };
    syncFromDb();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    localStorage.setItem('hanarLang', lang);
    setEffectiveLang(resolveEffectiveLang(lang));
  }, [lang]);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = effectiveLang;
  }, [effectiveLang]);

  const setLang = useCallback((newLang: string) => {
    setLangState(newLang);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('registeredaccounts')
        .update({ preferred_language: newLang })
        .eq('user_id', user.id)
        .then(() => {});
    });
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, effectiveLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/** Use in components for translated strings: const { t } = useTranslation(); then t('Home') */
export function useTranslation() {
  const { effectiveLang } = useLanguage();
  const t = useCallback((key: string) => tFromTranslations(effectiveLang, key), [effectiveLang]);
  return { t, lang: effectiveLang };
}
