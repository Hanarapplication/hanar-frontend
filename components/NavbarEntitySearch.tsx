'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { t } from '@/utils/translations';
import { cn } from '@/lib/utils';

type SearchResultItem = {
  type: 'user' | 'business' | 'organization';
  label: string;
  subtitle: string | null;
  imageUrl: string | null;
  href: string;
};

function typeLabel(lang: string, type: SearchResultItem['type']): string {
  if (type === 'business') return t(lang, 'Business');
  if (type === 'organization') return t(lang, 'Organization');
  return t(lang, 'Individual');
}

const searchToggleBtn =
  'relative inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-black transition-colors hover:bg-[#f2f2f2] active:scale-[0.97] dark:text-[#e4e6eb] dark:hover:bg-white/10 [-webkit-tap-highlight-color:transparent]';

export default function NavbarEntitySearch({ effectiveLang }: { effectiveLang: string }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [resultsOpen, setResultsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const collapse = useCallback(() => {
    setExpanded(false);
    setResultsOpen(false);
    setQuery('');
    setResults([]);
    setLoading(false);
  }, []);

  const expand = useCallback(() => {
    setExpanded(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
      const data = (await res.json()) as { results?: SearchResultItem[] };
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const node = rootRef.current;
      const target = e.target as Node | null;
      if (node && target && !node.contains(target)) collapse();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') collapse();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [expanded, collapse]);

  const pick = (href: string) => {
    collapse();
    router.push(href);
  };

  const showResultsPanel = expanded && resultsOpen && (query.trim().length >= 2 || loading);

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative flex items-center justify-end',
        expanded ? 'min-w-0 flex-1 max-w-none sm:max-w-xl lg:max-w-2xl' : 'shrink-0',
      )}
    >
      {!expanded ? (
        <button
          type="button"
          onClick={expand}
          className={searchToggleBtn}
          aria-label={t(effectiveLang, 'Search')}
          title={t(effectiveLang, 'Search')}
        >
          <Search className="h-6 w-6" strokeWidth={2} aria-hidden />
        </button>
      ) : (
        <div className="relative flex min-w-0 flex-1 items-center">
          <Search
            className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-black dark:text-[#e4e6eb]"
            strokeWidth={2}
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setResultsOpen(true);
            }}
            onFocus={() => setResultsOpen(true)}
            placeholder={t(effectiveLang, 'Search businesses, people, etc.')}
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-expanded={showResultsPanel}
            aria-label={t(effectiveLang, 'Search')}
            className="h-10 w-full min-w-0 rounded-full border border-[#e4e6eb] bg-[#f0f2f5] py-1.5 pl-8 pr-9 text-xs leading-snug text-[#050505] placeholder:text-xs placeholder:text-[#65676B] outline-none ring-[#1877F2] transition focus:border-[#1877F2] focus:bg-white focus:ring-2 sm:h-11 sm:pl-9 sm:pr-10 dark:border-[#3e4042] dark:bg-[#3a3b3c] dark:text-[#e4e6eb] dark:placeholder:text-[#b0b3b8] dark:focus:border-[#4599ff] dark:focus:bg-[#242526]"
          />
          <button
            type="button"
            onClick={collapse}
            className="absolute right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-[#65676B] transition hover:bg-[#e4e6eb] dark:text-[#b0b3b8] dark:hover:bg-white/10"
            aria-label={t(effectiveLang, 'Close')}
            title={t(effectiveLang, 'Close')}
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      )}

      {showResultsPanel ? (
        <div
          role="listbox"
          className={cn(
            'absolute z-[130] max-h-[min(18rem,calc(100vh-8rem))] overflow-y-auto rounded-xl border border-[#e4e6eb] bg-white py-1 shadow-xl dark:border-[#3e4042] dark:bg-[#242526]',
            expanded ? 'left-0 right-0 top-[calc(100%+4px)]' : 'hidden',
          )}
        >
          {loading ? (
            <p className="px-3 py-3 text-center text-xs text-[#65676B] dark:text-[#b0b3b8]">
              {t(effectiveLang, 'Searching…')}
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-center text-xs text-[#65676B] dark:text-[#b0b3b8]">
              {t(effectiveLang, 'No matches found')}
            </p>
          ) : (
            <ul className="divide-y divide-[#e4e6eb] dark:divide-[#3e4042]">
              {results.map((r) => (
                <li key={`${r.type}-${r.href}`}>
                  <button
                    type="button"
                    role="option"
                    onClick={() => pick(r.href)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[#f2f2f2] dark:hover:bg-white/5"
                  >
                    <span className="relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#e4e6eb] dark:bg-[#3e4042]">
                      {r.imageUrl ? <img src={r.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-sm font-medium text-[#050505] dark:text-[#e4e6eb]">
                        {r.label}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-[#65676B] dark:text-[#b0b3b8]">
                        <span className="rounded bg-[#f0f2f5] px-1.5 py-0.5 font-medium dark:bg-[#3a3b3c]">
                          {typeLabel(effectiveLang, r.type)}
                        </span>
                        {r.subtitle ? <span className="line-clamp-1">{r.subtitle}</span> : null}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

