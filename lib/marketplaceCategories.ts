/**
 * Taxonomy for individual marketplace posts and business retail product categories.
 * Stored in DB as a single string: `${label}${CATEGORY_SEPARATOR}${subcategory}`.
 */
export const CATEGORY_SEPARATOR = ' — ';

export type MarketplaceCategoryGroup = {
  label: string;
  subcategories: string[];
};

export const marketplaceCategories: MarketplaceCategoryGroup[] = [
  {
    label: 'Electronics',
    subcategories: [
      'Phones',
      'Computers & Laptops',
      'Tablets',
      'TVs',
      'Cameras',
      'Gaming',
      'Accessories',
      'Other Electronics',
    ],
  },
  {
    label: 'Vehicles',
    subcategories: [
      'Cars',
      'Trucks',
      'Motorcycles',
      'Boats',
      'RVs / Campers',
      'Vehicle Parts',
      'Other Vehicles',
    ],
  },
  {
    label: 'Home & Furniture',
    subcategories: [
      'Furniture',
      'Home Decor',
      'Kitchen Items',
      'Appliances',
      'Bedding',
      'Storage',
      'Outdoor / Patio',
      'Other Home Items',
    ],
  },
  {
    label: 'Clothing & Fashion',
    subcategories: [
      "Men's Clothing",
      "Women's Clothing",
      "Kids' Clothing",
      "Men's Shoes",
      "Women's Shoes",
      "Men's Suits & Formalwear",
      "Women's Suits & Formalwear",
      "Men's Watches",
      "Women's Watches",
      "Men's Jewelry",
      "Women's Jewelry",
      "Men's Bags",
      "Women's Bags",
      'Traditional Clothing',
      'Other Fashion',
    ],
  },
  {
    label: 'Baby & Kids',
    subcategories: [
      'Baby Gear',
      'Strollers',
      'Toys',
      "Kids' Furniture",
      "Kids' Clothing",
      'School Items',
      'Other Baby & Kids',
    ],
  },
  {
    label: 'Beauty & Personal Care',
    subcategories: [
      "Men's Skincare & Grooming",
      "Women's Skincare",
      "Men's Hair Care",
      "Women's Hair Care",
      "Men's Cologne",
      "Women's Perfume",
      'Unisex / General Fragrance',
      'Makeup',
      'Salon Tools',
      'Other Beauty Items',
    ],
  },
  {
    label: 'Books & Media',
    subcategories: [
      'Books',
      'Textbooks',
      'Religious Books',
      'Movies',
      'Music',
      'Collectibles',
      'Other Books & Media',
    ],
  },
  {
    label: 'Sports & Outdoors',
    subcategories: [
      'Fitness Equipment',
      'Bicycles',
      'Camping',
      'Sports Gear',
      'Outdoor Gear',
      'Other Sports Items',
    ],
  },
  {
    label: 'Tools & Equipment',
    subcategories: [
      'Power Tools',
      'Hand Tools',
      'Construction Equipment',
      'Garden Tools',
      'Mechanic Tools',
      'Other Tools',
    ],
  },
  {
    label: 'Food & Cultural Items',
    subcategories: [
      'Packaged Food',
      'Homemade Food',
      'Spices',
      'Tea & Coffee',
      'Cultural Decor',
      'Religious Items',
      'Other Cultural Items',
    ],
  },
  {
    label: 'Real Estate',
    subcategories: [
      'Homes for Sale',
      'Apartments for Rent',
      'Rooms for Rent',
      'Commercial Property',
      'Land',
      'Other Real Estate',
    ],
  },
  {
    label: 'Free Items',
    subcategories: [
      'Free Furniture',
      'Free Electronics',
      'Free Clothes',
      'Free Household Items',
      'Other Free Items',
    ],
  },
  {
    label: 'Other',
    subcategories: ['Miscellaneous', 'Not Sure'],
  },
];

const LABEL_SET = new Set(marketplaceCategories.map((c) => c.label));

export function formatMarketplaceCategory(parent: string, sub: string): string {
  const p = parent.trim();
  const s = sub.trim();
  if (!p || !s) return p || s || '';
  return `${p}${CATEGORY_SEPARATOR}${s}`;
}

/** True when the top-level group is Vehicles (for extra fields, image limits, etc.). */
export function isVehiclesCategoryParent(parent: string): boolean {
  return parent.trim() === 'Vehicles';
}

/**
 * Parse stored `category` into parent + sub for two dropdowns. Tolerates legacy
 * "Parent - Sub" and plain subcategory-only values when unambiguous.
 */
export function parseMarketplaceCategoryForForm(
  stored: string
): { parent: string; sub: string } {
  const raw = (stored || '').trim();
  if (!raw) return { parent: '', sub: '' };

  if (raw.includes(CATEGORY_SEPARATOR)) {
    const i = raw.indexOf(CATEGORY_SEPARATOR);
    const p = raw.slice(0, i).trim();
    const s = raw.slice(i + CATEGORY_SEPARATOR.length).trim();
    if (LABEL_SET.has(p) && s) {
      return { parent: p, sub: s };
    }
  }

  const alt = raw.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (alt) {
    const p = alt[1].trim();
    const s = alt[2].trim();
    if (LABEL_SET.has(p) && s) {
      return { parent: p, sub: s };
    }
  }

  const asLabel = marketplaceCategories.find((c) => c.label === raw);
  if (asLabel) {
    return { parent: asLabel.label, sub: asLabel.subcategories[0] || '' };
  }

  for (const c of marketplaceCategories) {
    if (c.subcategories.includes(raw)) {
      return { parent: c.label, sub: raw };
    }
  }

  return { parent: 'Other', sub: 'Miscellaneous' };
}

export function getParentOptions(storedCategory: string): string[] {
  const labels = marketplaceCategories.map((c) => c.label);
  const { parent } = parseMarketplaceCategoryForForm(storedCategory);
  if (parent && !labels.includes(parent)) return [...labels, parent];
  return labels;
}

export function getSubcategoryOptionsForParent(
  parent: string,
  storedCategory: string
): string[] {
  const def = marketplaceCategories.find((c) => c.label === parent);
  const base = def ? [...def.subcategories] : [];
  const { parent: p, sub: s } = parseMarketplaceCategoryForForm(storedCategory);
  if (p === parent && s && !base.includes(s)) base.push(s);
  return base;
}
