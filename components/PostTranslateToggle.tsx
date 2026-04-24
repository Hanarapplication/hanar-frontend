'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

type Props = {
  text: string;
  postId?: string | number;
  sourceLang?: string | null;
  targetLang?: string | null;
  prefetch?: boolean;
  className?: string;
};

const TEXT_TRANSLATION_CACHE_PREFIX = 'hanarTextTranslation:v2:';
const pendingRequests = new Map<string, Promise<string>>();

function normalizeLangCode(value: string | null | undefined): string | null {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'auto') return null;
  const primary = (raw.split(/[-_]/)[0] || '').trim();
  if (!/^[a-z]{2,3}$/.test(primary)) return null;
  return primary;
}

export default function PostTranslateToggle({ text, postId, sourceLang, targetLang, prefetch = false, className }: Props) {
  const { effectiveLang } = useLanguage();
  const [translated, setTranslated] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const target = String(targetLang || effectiveLang || '').trim().toLowerCase();
  const source = String(text || '').trim();
  if (!source || !target || target === 'en') return null;

  const cacheKey = useMemo(
    () => `${TEXT_TRANSLATION_CACHE_PREFIX}${target}:${postId ?? 'text'}:${source}`,
    [target, postId, source]
  );

  const fetchTranslation = async (): Promise<string> => {
    const existing = pendingRequests.get(cacheKey);
    if (existing) return existing;
    const request = (async () => {
      const cachedValue = localStorage.getItem(cacheKey);
      if (cachedValue) {
        return cachedValue;
      }

      let value = '';
      const normalizedSourceLang = normalizeLangCode(sourceLang || null);
      const normalizedTargetLang = normalizeLangCode(target);
      if (postId != null) {
        const qs = new URLSearchParams({ lang: target });
        const response = await fetch(`/api/posts/${encodeURIComponent(String(postId))}?${qs.toString()}`);
        if (response.ok) {
          const data = (await response.json()) as { content?: string };
          value = String(data.content || '').trim();
        } else {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          setError(data.error || 'Translation failed');
        }
      }
      // If post cache returns unchanged original-language text, retry full-text translation.
      const appearsUntranslatedFromPostCache =
        !!value &&
        source.includes(value) &&
        !!normalizedTargetLang &&
        (normalizedSourceLang == null || normalizedSourceLang !== normalizedTargetLang);

      if (!value || appearsUntranslatedFromPostCache) {
        // Non-post text (e.g. comments) goes through server translation on-demand.
        const response = await fetch('/api/translate/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: source,
            sourceLang: sourceLang || null,
            targetLang: target,
          }),
        });
        if (response.ok) {
          const data = (await response.json()) as { translatedText?: string };
          value = String(data.translatedText || '').trim();
        } else {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          setError(data.error || 'Translation failed');
        }
      }
      if (!value) {
        value = t(target, source);
      }
      const appearsUntranslated =
        !!value &&
        value.trim() === source.trim() &&
        !!normalizedTargetLang &&
        (normalizedSourceLang == null || normalizedSourceLang !== normalizedTargetLang);

      if (appearsUntranslated) {
        setError('Translation unavailable right now');
        return '';
      }
      if (value) {
        try {
          localStorage.setItem(cacheKey, value);
        } catch {
          // Ignore storage quota issues.
        }
      }
      return value;
    })();
    pendingRequests.set(cacheKey, request);
    try {
      return await request;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  };

  const loadTranslation = async () => {
    if (translated) {
      setOpen((value) => !value);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const value = await fetchTranslation();
      if (value) {
        setTranslated(value);
        setOpen(true);
      }
    } catch {
      setError('Translation failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cachedValue = localStorage.getItem(cacheKey);
    if (cachedValue) setTranslated(cachedValue);
  }, [cacheKey]);

  useEffect(() => {
    if (!prefetch) return;
    if (translated) return;
    let cancelled = false;
    void fetchTranslation()
      .then((value) => {
        if (!cancelled && value) setTranslated(value);
      })
      .catch(() => {
        // Keep non-blocking prefetch silent.
      });
    return () => {
      cancelled = true;
    };
  }, [prefetch, translated, cacheKey]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={loadTranslation}
        className="text-xs font-semibold text-indigo-600 hover:underline disabled:opacity-60 dark:text-indigo-300"
        disabled={loading}
      >
        {loading ? 'Translating...' : open ? 'Hide translation' : 'Translate text'}
      </button>
      {open && translated ? (
        <p className="mt-1 whitespace-pre-wrap rounded-md bg-indigo-50 px-2 py-1 text-sm text-slate-700 dark:bg-indigo-900/30 dark:text-slate-200">
          {translated}
        </p>
      ) : null}
      {!loading && error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
