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
