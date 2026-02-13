/**
 * Business categories and subcategories for the edit business page.
 * Category determines which inventory sections show (menu, dealership, retail, real estate).
 * Subcategory is stored for display and filtering.
 */
export interface BusinessSubcategory {
  value: string;
  label: string;
}

export interface BusinessCategory {
  value: string;
  label: string;
  icon: string;
  subcategories: BusinessSubcategory[];
}

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  {
    value: 'Dealership',
    label: 'Dealership',
    icon: '🚗',
    subcategories: [
      { value: 'Boat Dealer', label: 'Boat Dealer' },
      { value: 'Car Dealer', label: 'Car Dealer' },
      { value: 'Heavy Equipment Dealer', label: 'Heavy Equipment Dealer' },
      { value: 'Motorcycle Dealer', label: 'Motorcycle Dealer' },
      { value: 'Other Dealership', label: 'Other Dealership' },
      { value: 'RV / Camper Dealer', label: 'RV / Camper Dealer' },
      { value: 'Truck Dealer', label: 'Truck Dealer' },
    ],
  },
  {
    value: 'Food',
    label: 'Food',
    icon: '🍽',
    subcategories: [
      { value: 'Bakery', label: 'Bakery' },
      { value: 'Butcher Shop', label: 'Butcher Shop' },
      { value: 'Cafe / Coffee Shop', label: 'Cafe / Coffee Shop' },
      { value: 'Catering', label: 'Catering' },
      { value: 'Dessert Shop', label: 'Dessert Shop' },
      { value: 'Food Truck', label: 'Food Truck' },
      { value: 'Grocery / Market', label: 'Grocery / Market' },
      { value: 'Juice Bar', label: 'Juice Bar' },
      { value: 'Other Food Business', label: 'Other Food Business' },
      { value: 'Restaurant', label: 'Restaurant' },
    ],
  },
  {
    value: 'Real Estate',
    label: 'Real Estate',
    icon: '🏠',
    subcategories: [
      { value: 'Other Real Estate Services', label: 'Other Real Estate Services' },
      { value: 'Property Management', label: 'Property Management' },
      { value: 'Real Estate Agency', label: 'Real Estate Agency' },
      { value: 'Real Estate Broker', label: 'Real Estate Broker' },
      { value: 'Real Estate Developer', label: 'Real Estate Developer' },
    ],
  },
  {
    value: 'Retail',
    label: 'Retail',
    icon: '🛍',
    subcategories: [
      { value: 'Beauty Supply', label: 'Beauty Supply' },
      { value: 'Bookstore', label: 'Bookstore' },
      { value: 'Clothing Store', label: 'Clothing Store' },
      { value: 'Convenience Store', label: 'Convenience Store' },
      { value: 'Electronics Store', label: 'Electronics Store' },
      { value: 'Furniture Store', label: 'Furniture Store' },
      { value: 'Grocery Store', label: 'Grocery Store' },
      { value: 'Home Appliances', label: 'Home Appliances' },
      { value: 'Jewelry Store', label: 'Jewelry Store' },
      { value: 'Other Retail Store', label: 'Other Retail Store' },
      { value: 'Pet Store', label: 'Pet Store' },
    ],
  },
  {
    value: 'Services',
    label: 'Services',
    icon: '🔧',
    subcategories: [
      { value: 'Accounting', label: 'Accounting' },
      { value: 'Auto Repair', label: 'Auto Repair' },
      { value: 'Barber Shop', label: 'Barber Shop' },
      { value: 'Cleaning Service', label: 'Cleaning Service' },
      { value: 'Electrical', label: 'Electrical' },
      { value: 'Hair Salon', label: 'Hair Salon' },
      { value: 'HVAC', label: 'HVAC' },
      { value: 'Insurance Agency', label: 'Insurance Agency' },
      { value: 'IT Services', label: 'IT Services' },
      { value: 'Landscaping', label: 'Landscaping' },
      { value: 'Legal Services', label: 'Legal Services' },
      { value: 'Marketing Agency', label: 'Marketing Agency' },
      { value: 'Moving Company', label: 'Moving Company' },
      { value: 'Nail Salon', label: 'Nail Salon' },
      { value: 'Plumbing', label: 'Plumbing' },
      { value: 'Real Estate Agent', label: 'Real Estate Agent' },
      { value: 'Staffing Agency', label: 'Staffing Agency' },
      { value: 'Tax Services', label: 'Tax Services' },
      { value: 'Tutoring', label: 'Tutoring' },
      { value: 'Trucking Company', label: 'Trucking Company' },
      { value: 'Other Services', label: 'Other Services' },
    ],
  },
];

/** Map legacy DB category value to (category, subcategory). */
export function normalizeLegacyCategory(value?: string | null): { category: string; subcategory: string } {
  const v = (value || '').trim();
  if (v === 'Restaurant') return { category: 'Food', subcategory: 'Restaurant' };
  if (v === 'Car Dealership') return { category: 'Dealership', subcategory: 'Car Dealer' };
  if (['Retail', 'retail', 'retails'].includes(v)) return { category: 'Retail', subcategory: '' };
  if (['Real Estate', 'real estate', 'real_estate'].includes(v)) return { category: 'Real Estate', subcategory: '' };
  if (['Services', 'services', 'other', 'something_else'].includes(v)) return { category: 'Services', subcategory: '' };
  const match = BUSINESS_CATEGORIES.find((c) => c.value === v);
  if (match) return { category: v, subcategory: '' };
  return { category: '', subcategory: '' };
}

/** Main category only (for section visibility: menu, dealership, retail, real estate). */
export function getMainCategory(value?: string | null): string {
  const { category } = normalizeLegacyCategory(value);
  return category;
}

export function isFoodCategory(value?: string | null): boolean {
  return getMainCategory(value) === 'Food';
}

export function isDealershipCategory(value?: string | null): boolean {
  return getMainCategory(value) === 'Dealership';
}

export function isRetailCategory(value?: string | null): boolean {
  return getMainCategory(value) === 'Retail';
}

export function isRealEstateCategory(value?: string | null): boolean {
  return getMainCategory(value) === 'Real Estate';
}

export function isServicesCategory(value?: string | null): boolean {
  return getMainCategory(value) === 'Services';
}
