/**
 * Emoji for marketplace category filter chips (English UI labels, case-insensitive).
 * Covers taxonomy parents, common normalized keys, and light fuzzy fallbacks.
 */
const EXACT: Record<string, string> = {
  // Top-level marketplace taxonomy (lib/marketplaceCategories.ts)
  electronics: '💻',
  vehicles: '🚗',
  'home & furniture': '🛋️',
  'clothing & fashion': '👔',
  'baby & kids': '🧸',
  'beauty & personal care': '💄',
  'books & media': '📚',
  'sports & outdoors': '⚽',
  'tools & equipment': '🔧',
  'food & cultural items': '🌶️',
  'real estate': '🏡',
  'free items': '🎁',
  other: '✨',

  // Common chip keys from normalize + legacy
  cars: '🚗',
  car: '🚗',
  retail: '🛍️',
  general: '🏷️',
  dealership: '🚘',
  realestate: '🏡',
  phones: '📱',
  phone: '📱',
  fashion: '👕',
  clothes: '👕',
  shoes: '👟',
  furniture: '🛋️',
  beauty: '💄',
  groceries: '🛒',
  tools: '🧰',
};

export function getMarketplaceCategoryIcon(label: string): string {
  const k = String(label).trim().toLowerCase();
  if (!k) return '🏷️';
  if (EXACT[k]) return EXACT[k]!;

  if (k.includes('vehicle') || k === 'trucks' || k === 'suv' || k === 'boat' || k.includes('motor')) return '🚗';
  if (k.includes('electronic') || k.includes('laptop') || k.includes('camera') || k.includes('tablet') || k.includes('tv')) {
    return '💻';
  }
  if (k.includes('fashion') || k.includes('clothing') || k.includes("men's") || k.includes("women's") || k.includes("kids'") || k.includes('jewelry') || k.includes('watches') || k.includes(' shoe')) {
    return '👔';
  }
  if (k.includes('home') && k.includes('furniture')) return '🛋️';
  if (k.includes('furniture') || k.includes('decor') || k.includes('appliance') || k.includes('bedding')) return '🛋️';
  if (k.includes('baby') || k.includes('toy') || k.includes('stroller')) return '🧸';
  if (k.includes('beauty') || k.includes('cologne') || k.includes('perfume') || k.includes('skincare') || k.includes('makeup') || k.includes('hair ')) {
    return '💄';
  }
  if (k.includes('book') || k.includes('movie') || k.includes('music') || k.includes('media')) return '📚';
  if (k.includes('sport') || k.includes('outdoor') || k.includes('fitness') || k.includes('camping') || k.includes('bicycl') || k.includes('gym')) {
    return '⚽';
  }
  if (k.includes('tool') || k.includes('wrench') || k.includes('drill')) return '🔧';
  if (k.includes('food') || k.includes('spice') || k.includes('coffee') || k.includes('tea ')) return '🌶️';
  if (k.includes('real estate') || k.includes('realest') || k.includes('apartment') || k.includes('rent') || k.includes('property')) {
    return '🏡';
  }
  if (k.includes('free ')) return '🎁';
  if (k.includes('dealership') || k.includes('dealer')) return '🚘';
  if (k.includes('phone') || k.includes('gadget')) return '📱';
  if (k.includes('market') && k.includes('place')) return '🛒';

  return '🔖';
}
