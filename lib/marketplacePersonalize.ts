/** Client-side marketplace personalization (browsed listings + search terms). */

export type MarketplaceItemSource = 'retail' | 'dealership' | 'real_estate' | 'individual';

const STORAGE_KEY = 'hanar_marketplace_browse_v1';
const MAX_ENTRIES = 40;

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'with', 'from', 'new', 'used', 'sale', 'item', 'listing',
  'this', 'that', 'your', 'our', 'are', 'was', 'has', 'have', 'all', 'any', 'can', 'per', 'each',
]);

export type StoredBrowseRow = {
  source: MarketplaceItemSource;
  id: string;
  categoryNorm: string;
  tokens: string[];
  at: number;
};

export type BrowsedMarketplaceEntry = StoredBrowseRow & { weight: number };

function normalizeCategory(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function tokenizeMarketplaceText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function rowWeight(index: number): number {
  return 1 / (1 + index * 0.07);
}

export function readMarketplaceBrowseSignals(): BrowsedMarketplaceEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredBrowseRow[];
    if (!Array.isArray(parsed)) return [];
    const out: BrowsedMarketplaceEntry[] = [];
    for (let i = 0; i < parsed.length; i += 1) {
      const r = parsed[i];
      if (!r || !r.source || !r.id) continue;
      const tokens = Array.isArray(r.tokens) ? r.tokens.filter((t) => typeof t === 'string' && t.length >= 2) : [];
      out.push({
        source: r.source,
        id: String(r.id),
        categoryNorm: typeof r.categoryNorm === 'string' ? r.categoryNorm : '',
        tokens: Array.from(new Set(tokens)).slice(0, 24),
        at: typeof r.at === 'number' ? r.at : 0,
        weight: rowWeight(i),
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function recordMarketplaceItemView(input: {
  source: MarketplaceItemSource;
  id: string;
  title: string;
  category: string;
}): void {
  if (typeof window === 'undefined') return;
  const id = String(input.id).trim();
  if (!id) return;
  const categoryNorm = normalizeCategory(input.category || '');
  const tokens = tokenizeMarketplaceText(`${input.title || ''} ${input.category || ''}`).slice(0, 20);
  const row: StoredBrowseRow = {
    source: input.source,
    id,
    categoryNorm,
    tokens,
    at: Date.now(),
  };
  try {
    const prev = readStoredRowsRaw();
    const key = `${row.source}:${row.id}`;
    const filtered = prev.filter((r) => `${r.source}:${r.id}` !== key);
    const next = [row, ...filtered].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

function readStoredRowsRaw(): StoredBrowseRow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredBrowseRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export type ItemPersonalizationInput = {
  id: string;
  source: MarketplaceItemSource;
  title: string;
  category: string;
  description?: string | null;
  location?: string | null;
};

/** Higher = more aligned with recent views (excludes same listing). */
export function personalizationScoreForItem(
  item: ItemPersonalizationInput,
  browsed: BrowsedMarketplaceEntry[],
): number {
  if (!browsed.length) return 0;
  const selfKey = `${item.source}:${item.id}`;
  const text = `${item.title} ${item.category} ${item.description || ''} ${item.location || ''}`.toLowerCase();
  const cat = normalizeCategory(item.category || '');
  let score = 0;

  for (const b of browsed) {
    if (`${b.source}:${b.id}` === selfKey) continue;
    const w = b.weight;
    if (b.categoryNorm && cat) {
      if (cat === b.categoryNorm || cat.includes(b.categoryNorm) || b.categoryNorm.includes(cat)) {
        score += 8 * w;
      }
    }
    if (b.source === item.source) score += 1.5 * w;
    for (const t of b.tokens) {
      if (t.length >= 3 && text.includes(t)) score += 2 * w;
      else if (t.length === 2 && text.includes(t)) score += 0.8 * w;
    }
  }
  return Math.round(score * 10) / 10;
}
