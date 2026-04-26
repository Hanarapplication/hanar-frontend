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
const LANGUAGE_ALIASES: Record<string, string> = {
  iw: 'he',
  in: 'id',
  kr: 'ko',
  kz: 'kk',
  kazakh: 'kk',
  'қазақша': 'kk',
  korean: 'ko',
  '한국어': 'ko',
  malay: 'ms',
  melayu: 'ms',
  bahasa: 'ms',
  'bahasa melayu': 'ms',
  'bahasa malaysia': 'ms',
  '🇲🇾': 'ms',
  polish: 'pl',
  polski: 'pl',
  '🇵🇱': 'pl',
  portuguese: 'pt',
  português: 'pt',
  portugues: 'pt',
  '🇵🇹': 'pt',
  russian: 'ru',
  русский: 'ru',
  '🇷🇺': 'ru',
  mm: 'my',
  burmese: 'my',
  myanmar: 'my',
  'မြန်မာ': 'my',
};
const UI_TRANSLATION_CACHE_PREFIX = 'hanarUiTranslationsV33:';
const HOME_POST_FEED_LANG_KEY = 'hanar_community_feed_lang';
const FEED_LANG_SYNC_EVENT = 'hanar:post-feed-lang-sync';
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'OPTION']);
const MAX_NODES_PER_PASS = 10000;
const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'aria-placeholder'] as const;
const INPUT_VALUE_TYPES = new Set(['button', 'submit', 'reset']);
const NAME_LINK_SKIP_SELECTOR = [
  'a[href^="/business/"]',
  'a[href^="/businesses/"]',
  'a[href^="/organization/"]',
  'a[href^="/organizations/"]',
  'a[href^="/profile/"]',
].join(', ');

function shouldSkipElementTranslationContext(element: Element | null): boolean {
  if (!element) return true;
  return !!(element.closest('[data-no-translate]') || element.closest(NAME_LINK_SKIP_SELECTOR));
}

function shouldSkipAutoTranslation(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/admin-login'
  );
}

function shouldForceEnglish(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

function resolveEffectiveLang(lang: string): string {
  const normalizeCode = (value: string): string => {
    const raw = (value || '').trim().toLowerCase();
    if (!raw) return '';
    const base = raw.split(/[-_]/)[0] || raw;
    if (LANGUAGE_ALIASES[base]) return LANGUAGE_ALIASES[base];
    return base;
  };

  if (lang !== 'auto') {
    const normalized = normalizeCode(lang);
    return SUPPORTED_CODES.has(normalized) ? normalized : 'en';
  }
  if (typeof navigator === 'undefined') return 'en';
  const browser = normalizeCode(navigator.language);
  return SUPPORTED_CODES.has(browser) ? browser : 'en';
}

function normalizeSelectedLang(value: string): string {
  const raw = (value || '').trim().toLowerCase();
  if (!raw) return 'auto';
  if (raw === 'auto') return 'auto';

  const base = raw.split(/[-_]/)[0] || raw;
  const normalized = LANGUAGE_ALIASES[base] || base;
  if (normalized === 'auto') return 'auto';
  return SUPPORTED_CODES.has(normalized) ? normalized : 'en';
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
    try {
      const savedLang = localStorage.getItem('hanarLang');
      if (savedLang) setLangState(normalizeSelectedLang(savedLang));
    } catch {
      // Ignore storage access errors on strict mobile privacy modes.
    }
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
          key.startsWith('hanarUiTranslationsV20:') ||
          key.startsWith('hanarUiTranslationsV21:') ||
          key.startsWith('hanarUiTranslationsV22:') ||
          key.startsWith('hanarUiTranslationsV23:') ||
          key.startsWith('hanarUiTranslationsV24:') ||
          key.startsWith('hanarUiTranslationsV25:') ||
          key.startsWith('hanarUiTranslationsV26:') ||
          key.startsWith('hanarUiTranslationsV27:') ||
          key.startsWith('hanarUiTranslationsV28:') ||
          key.startsWith('hanarUiTranslationsV29:')
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
    try {
      localStorage.setItem('hanarLang', lang);
    } catch {
      // Ignore storage access errors on strict mobile privacy modes.
    }
    setEffectiveLang(shouldForceEnglish(pathname) ? 'en' : resolveEffectiveLang(lang));
  }, [lang, pathname]);

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
        const extended = node as Text & { __hanarOriginalText?: string };
        const parent = node.parentElement;
        if (!parent) {
          current = walker.nextNode();
          continue;
        }
        if (SKIP_TAGS.has(parent.tagName) || shouldSkipElementTranslationContext(parent)) {
          // If this node was previously translated, restore its original source text.
          if (typeof extended.__hanarOriginalText === 'string') {
            node.nodeValue = extended.__hanarOriginalText;
          }
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
        const extended = element as HTMLElement & {
          __hanarOriginalAttrs?: Record<string, string>;
        };
        if (shouldSkipElementTranslationContext(element)) {
          if (extended.__hanarOriginalAttrs) {
            TRANSLATABLE_ATTRIBUTES.forEach((attributeName) => {
              const original = extended.__hanarOriginalAttrs?.[attributeName];
              if (typeof original === 'string') {
                element.setAttribute(attributeName, original);
              }
            });
            if (element instanceof HTMLInputElement && INPUT_VALUE_TYPES.has((element.type || '').toLowerCase())) {
              const originalValue = extended.__hanarOriginalAttrs.value;
              if (typeof originalValue === 'string') {
                element.value = originalValue;
              }
            }
          }
          return;
        }
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
    const loadTranslations = async () => {
      const cacheKey = `${UI_TRANSLATION_CACHE_PREFIX}${effectiveLang}`;
      // Prevent stale in-memory runtime maps from pinning a wrong locale payload.
      // If fetch fails, t() will still fall back to bundled static translations.
      setRuntimeTranslations(effectiveLang, {});

      try {
        const localePath = `/locales/${encodeURIComponent(effectiveLang)}.json`;
        const localeVersion = encodeURIComponent(UI_TRANSLATION_CACHE_PREFIX);
        const now = Date.now();
        const origin =
          typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
        const candidates: Array<{ url: string; init?: RequestInit }> = [
          {
            url: `${localePath}?v=${localeVersion}&t=${now}`,
            init: {
              cache: 'no-store',
              headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
            },
          },
          {
            url: localePath,
            init: {
              cache: 'reload',
              headers: { 'Cache-Control': 'no-cache' },
            },
          },
          ...(origin
            ? [
                {
                  url: `${origin}${localePath}?v=${localeVersion}&t=${now}`,
                  init: {
                    cache: 'no-store' as RequestCache,
                    credentials: 'same-origin' as RequestCredentials,
                    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
                  },
                },
              ]
            : []),
        ];

        let data: Record<string, string> | null = null;
        for (let attempt = 0; attempt < 3 && !data; attempt += 1) {
          for (const candidate of candidates) {
            try {
              const response = await fetch(candidate.url, candidate.init);
              if (!response.ok) continue;
              const parsed = (await response.json()) as Record<string, string>;
              if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                data = parsed;
                break;
              }
            } catch {
              // Try next candidate.
            }
          }
          if (!data && attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 180 * (attempt + 1)));
          }
        }

        if (cancelled) return;
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          setRuntimeTranslations(effectiveLang, data);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
          } catch {
            // Ignore storage quota/access issues.
          }
          setTranslationRevision((value) => value + 1);
          return;
        }
      } catch {
        // Keep local fallback translations when locale file fetch fails.
      }

      // Fallback to local cache only if fresh fetch did not succeed.
      try {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as Record<string, string>;
          if (cached && typeof cached === 'object' && Object.keys(cached).length > 0) {
            setRuntimeTranslations(effectiveLang, cached);
            setTranslationRevision((value) => value + 1);
          }
        }
      } catch {
        // Ignore storage access/parsing issues (common on some mobile privacy modes).
      }
    };
    void loadTranslations();
    return () => {
      cancelled = true;
    };
  }, [effectiveLang]);

  /** UI / translations only — does not update post language or feed personalization (see home/community language controls). */
  const setLang = useCallback((newLang: string) => {
    const normalized = normalizeSelectedLang(newLang);
    setLangState(normalized);
    // One-way sync: changing app language also updates the home/community post language filter.
    // Feed language controls remain independent and never change app UI language.
    if (normalized !== 'auto') {
      try {
        localStorage.setItem(HOME_POST_FEED_LANG_KEY, normalized);
      } catch {
        // Ignore storage access errors.
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(FEED_LANG_SYNC_EVENT, { detail: { lang: normalized } }));
      }
    }
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
