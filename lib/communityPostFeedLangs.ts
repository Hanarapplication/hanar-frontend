import { supportedLanguages } from '@/utils/languages';

const SUPPORTED = new Set(
  supportedLanguages.filter((l) => l.code !== 'auto').map((l) => l.code)
);

export function normalizeFeedLangCode(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase();
  if (!t || t === 'all' || t === 'auto') return null;
  const two = t.length >= 2 ? t.slice(0, 2) : t;
  return SUPPORTED.has(two) ? two : null;
}

export function normalizeFeedLangsList(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    const n = normalizeFeedLangCode(String(x));
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/** Parse `localStorage` value: legacy plain code (`fa`) or JSON array (`["en","fa"]`). */
export function parseStoredFeedLangs(raw: string | null | undefined): string[] {
  if (raw == null || raw === '') return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      return normalizeFeedLangsList(JSON.parse(trimmed) as unknown);
    } catch {
      return [];
    }
  }
  const single = normalizeFeedLangCode(trimmed);
  return single ? [single] : [];
}

export function serializeFeedLangsForStorage(langs: string[]): string {
  return JSON.stringify(normalizeFeedLangsList(langs));
}

export function feedLangsCacheKey(langs: string[]): string {
  return normalizeFeedLangsList(langs).sort().join(',') || 'all';
}

export function primaryPostLangCode(p: unknown): string | null {
  if (!p || typeof p !== 'object') return null;
  const v = (p as { language?: unknown }).language;
  if (v == null || v === '') return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;
  const primary = (s.split(/[-_]/)[0] || s).trim();
  if (!primary) return null;
  return primary.length >= 2 ? primary.slice(0, 2) : primary;
}

/** When `langs` is empty, all posts match. Unknown language matches only if `en` is selected. */
export function postMatchesFeedLangs(p: unknown, langs: string[]): boolean {
  if (!langs.length) return true;
  const c = primaryPostLangCode(p);
  if (c == null) return langs.includes('en');
  return langs.includes(c);
}

export function resolveFeedLangsFromHomeBody(body: {
  feedLangs?: unknown;
  feedLang?: string | null;
}): string[] {
  const fromArr = normalizeFeedLangsList(body.feedLangs);
  if (fromArr.length) return fromArr;
  const single = normalizeFeedLangCode(body.feedLang ?? null);
  return single ? [single] : [];
}

export function resolveFeedLangsFromListBody(body: { langs?: unknown; lang?: string | null }): string[] {
  const fromArr = normalizeFeedLangsList(body.langs);
  if (fromArr.length) return fromArr;
  const single = normalizeFeedLangCode(typeof body.lang === 'string' ? body.lang : '');
  return single ? [single] : [];
}
