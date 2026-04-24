'use client';

import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

type Props = {
  text: string;
  postId?: string | number;
  sourceLang?: string | null;
  className?: string;
};

const TEXT_TRANSLATION_CACHE_PREFIX = 'hanarTextTranslation:';

export default function PostTranslateToggle({ text, postId, sourceLang, className }: Props) {
  const { effectiveLang } = useLanguage();
  const [translated, setTranslated] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const source = String(text || '').trim();
  if (!source || effectiveLang === 'en') return null;

  const loadTranslation = async () => {
    if (translated) {
      setOpen((value) => !value);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const cacheKey = `${TEXT_TRANSLATION_CACHE_PREFIX}${effectiveLang}:${postId ?? 'text'}:${source}`;
      const cachedValue = localStorage.getItem(cacheKey);
      if (cachedValue) {
        setTranslated(cachedValue);
        setOpen(true);
        return;
      }

      let value = '';
      if (postId != null) {
        const qs = new URLSearchParams({ lang: effectiveLang });
        if (sourceLang) qs.set('source', String(sourceLang));
        const response = await fetch(`/api/posts/${encodeURIComponent(String(postId))}?${qs.toString()}`);
        if (response.ok) {
          const data = (await response.json()) as { content?: string };
          value = String(data.content || '').trim();
        } else {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          setError(data.error || 'Translation failed');
        }
      }
      if (!value) {
        // Non-post text (e.g. comments) goes through server translation on-demand.
        const response = await fetch('/api/translate/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: source,
            sourceLang: sourceLang || null,
            targetLang: effectiveLang,
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
        value = t(effectiveLang, source);
      }
      if (value) {
        setTranslated(value);
        try {
          localStorage.setItem(cacheKey, value);
        } catch {
          // Ignore storage quota issues.
        }
        setOpen(true);
      }
    } finally {
      setLoading(false);
    }
  };

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
