'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { t as tFromTranslations } from '@/utils/translations';
import { setRuntimeTranslations, getRuntimeTranslations } from '@/utils/runtimeTranslations';
import { supportedLanguages } from '@/utils/languages';

const SUPPORTED_CODES = new Set(
  supportedLanguages
    .map((entry) => entry.code)
    .filter((code) => code !== 'auto')
);
const UI_TRANSLATION_CACHE_PREFIX = 'hanarUiTranslationsV21:';
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'OPTION']);
const MAX_NODES_PER_PASS = 10000;
const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'aria-placeholder'] as const;
const INPUT_VALUE_TYPES = new Set(['button', 'submit', 'reset']);

function shouldSkipAutoTranslation(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/admin-login'
  );
}

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
  /** Internal counter to trigger rerenders when runtime translations finish loading. */
  translationRevision: number;
};

const LanguageContext = createContext<LanguageContextType>({
  lang: 'auto',
  setLang: () => {},
  effectiveLang: 'en',
  translationRevision: 0,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const [lang, setLangState] = useState('auto');
  const [effectiveLang, setEffectiveLang] = useState('en');
  const [translationRevision, setTranslationRevision] = useState(0);

  useEffect(() => {
    const savedLang = localStorage.getItem('hanarLang');
    if (savedLang) setLangState(savedLang);
    // Drop old cache versions so newly added keys can load.
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (
          key.startsWith('hanarUiTranslationsV1:') ||
          key.startsWith('hanarUiTranslationsV2:') ||
          key.startsWith('hanarUiTranslationsV3:') ||
          key.startsWith('hanarUiTranslationsV4:') ||
          key.startsWith('hanarUiTranslationsV5:') ||
          key.startsWith('hanarUiTranslationsV6:') ||
          key.startsWith('hanarUiTranslationsV7:') ||
          key.startsWith('hanarUiTranslationsV8:') ||
          key.startsWith('hanarUiTranslationsV9:') ||
          key.startsWith('hanarUiTranslationsV10:') ||
          key.startsWith('hanarUiTranslationsV11:') ||
          key.startsWith('hanarUiTranslationsV12:') ||
          key.startsWith('hanarUiTranslationsV13:') ||
          key.startsWith('hanarUiTranslationsV14:') ||
          key.startsWith('hanarUiTranslationsV15:') ||
          key.startsWith('hanarUiTranslationsV16:') ||
          key.startsWith('hanarUiTranslationsV17:') ||
          key.startsWith('hanarUiTranslationsV18:') ||
          key.startsWith('hanarUiTranslationsV19:') ||
          key.startsWith('hanarUiTranslationsV20:')
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch {
      // Ignore storage access errors.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('hanarLang', lang);
    setEffectiveLang(resolveEffectiveLang(lang));
  }, [lang]);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = effectiveLang;
  }, [effectiveLang]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (shouldSkipAutoTranslation(pathname)) return;

    const collectTextNodes = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      let current = walker.nextNode();
      while (current && nodes.length < MAX_NODES_PER_PASS) {
        const node = current as Text;
        const parent = node.parentElement;
        if (!parent) {
          current = walker.nextNode();
          continue;
        }
        if (SKIP_TAGS.has(parent.tagName) || parent.closest('[data-no-translate]')) {
          current = walker.nextNode();
          continue;
        }
        const raw = node.nodeValue || '';
        if (raw.trim()) nodes.push(node);
        current = walker.nextNode();
      }
      return nodes;
    };

    const collectTranslatableElements = () => {
      const all = Array.from(document.body.querySelectorAll<HTMLElement>('*'));
      return all.slice(0, MAX_NODES_PER_PASS);
    };

    const applyDomTranslations = () => {
      const nodes = collectTextNodes();
      const elements = collectTranslatableElements();
      const map = getRuntimeTranslations(effectiveLang);
      nodes.forEach((node) => {
        const extended = node as Text & { __hanarOriginalText?: string };
        if (typeof extended.__hanarOriginalText !== 'string') {
          extended.__hanarOriginalText = node.nodeValue || '';
        }
        const original = extended.__hanarOriginalText;
        if (effectiveLang === 'en') {
          node.nodeValue = original;
          return;
        }
        const key = original.trim();
        if (!key) return;
        const translated = map[key];
        if (!translated) {
          return;
        }
        const leading = original.match(/^\s*/)?.[0] || '';
        const trailing = original.match(/\s*$/)?.[0] || '';
        node.nodeValue = `${leading}${translated}${trailing}`;
      });

      elements.forEach((element) => {
        if (element.closest('[data-no-translate]')) return;
        const extended = element as HTMLElement & {
          __hanarOriginalAttrs?: Record<string, string>;
        };
        if (!extended.__hanarOriginalAttrs) {
          extended.__hanarOriginalAttrs = {};
        }

        TRANSLATABLE_ATTRIBUTES.forEach((attributeName) => {
          const currentValue = element.getAttribute(attributeName);
          if (!currentValue || !currentValue.trim()) return;

          if (extended.__hanarOriginalAttrs && typeof extended.__hanarOriginalAttrs[attributeName] !== 'string') {
            extended.__hanarOriginalAttrs[attributeName] = currentValue;
          }
          const original = extended.__hanarOriginalAttrs?.[attributeName] || currentValue;
          const key = original.trim();
          if (!key) return;

          if (effectiveLang === 'en') {
            element.setAttribute(attributeName, original);
            return;
          }
          const translated = map[key];
          if (!translated) {
            return;
          }
          element.setAttribute(attributeName, translated);
        });

        if (element instanceof HTMLInputElement && INPUT_VALUE_TYPES.has((element.type || '').toLowerCase())) {
          if (typeof extended.__hanarOriginalAttrs.value !== 'string') {
            extended.__hanarOriginalAttrs.value = element.value || '';
          }
          const originalValue = extended.__hanarOriginalAttrs.value || '';
          const key = originalValue.trim();
          if (!key) return;

          if (effectiveLang === 'en') {
            element.value = originalValue;
            return;
          }
          const translated = map[key];
          if (!translated) {
            return;
          }
          element.value = translated;
        }
      });
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    const queueApply = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        applyDomTranslations();
      }, 60);
    };

    const observer = new MutationObserver(() => {
      queueApply();
    });

    queueApply();
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });

    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [effectiveLang, pathname, translationRevision]);

  useEffect(() => {
    let cancelled = false;
    if (effectiveLang === 'en') {
      setRuntimeTranslations('en', {});
      setTranslationRevision((value) => value + 1);
      return;
    }
    const loadTranslations = async () => {
      try {
        const cacheKey = `${UI_TRANSLATION_CACHE_PREFIX}${effectiveLang}`;
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as Record<string, string>;
          if (cached && typeof cached === 'object' && Object.keys(cached).length > 0) {
            setRuntimeTranslations(effectiveLang, cached);
            setTranslationRevision((value) => value + 1);
            return;
          }
        }

        const response = await fetch(`/api/translate-ui?lang=${encodeURIComponent(effectiveLang)}`);
        if (!response.ok) return;
        const data = (await response.json()) as { translations?: Record<string, string> };
        if (cancelled) return;
        if (data && typeof data === 'object') {
          const translations = (data as { translations?: Record<string, string> }).translations;
          const map = translations && typeof translations === 'object' ? translations : (data as Record<string, string>);
          setRuntimeTranslations(effectiveLang, map);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(map));
          } catch {
            // Ignore storage quota issues.
          }
          setTranslationRevision((value) => value + 1);
        }
      } catch {
        // Keep local fallback translations when API fails.
      }
    };
    void loadTranslations();
    return () => {
      cancelled = true;
    };
  }, [effectiveLang]);

  /** UI / translations only — does not update post language or feed personalization (see home/community language controls). */
  const setLang = useCallback((newLang: string) => {
    setLangState(newLang);
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, effectiveLang, translationRevision }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/** Use in components for translated strings: const { t } = useTranslation(); then t('Home') */
export function useTranslation() {
  const { effectiveLang, translationRevision } = useLanguage();
  const t = useCallback((key: string) => tFromTranslations(effectiveLang, key), [effectiveLang, translationRevision]);
  return { t, lang: effectiveLang };
}
