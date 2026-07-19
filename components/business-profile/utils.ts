export function formatBusinessCategory(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  const map: Record<string, string> = {
    restaurant: 'Restaurant',
    food: 'Food & Dining',
    retail: 'Retail',
    store: 'Store',
    shop: 'Shop',
    dealership: 'Car Dealership',
    auto: 'Auto',
    car: 'Car Dealership',
    real_estate: 'Real Estate',
    other: 'Other',
    something_else: 'Other',
  };
  for (const [key, label] of Object.entries(map)) {
    if (normalized.includes(key)) return label;
  }
  return normalized
    .split(/[\s-_]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

/** Names at/above this length crowd the hero header icon row. */
export const BUSINESS_NAME_HEADER_LONG_THRESHOLD = 13;

/** When true, relocate announcement (etc.) from the header into the contact row. */
export function isBusinessNameLongForHeader(name: string | null | undefined): boolean {
  return String(name || '').trim().length >= BUSINESS_NAME_HEADER_LONG_THRESHOLD;
}
