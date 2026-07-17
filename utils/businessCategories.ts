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
      { value: 'ATV / UTV Dealer', label: 'ATV / UTV Dealer' },
      { value: 'Boat Dealer', label: 'Boat Dealer' },
      { value: 'Car Dealer', label: 'Car Dealer' },
      { value: 'Heavy Equipment Dealer', label: 'Heavy Equipment Dealer' },
      { value: 'Motorcycle Dealer', label: 'Motorcycle Dealer' },
      { value: 'Other Dealership', label: 'Other Dealership' },
      { value: 'RV / Camper Dealer', label: 'RV / Camper Dealer' },
      { value: 'Trailer Dealer', label: 'Trailer Dealer' },
      { value: 'Truck Dealer', label: 'Truck Dealer' },
    ],
  },
  {
    value: 'Health',
    label: 'Health',
    icon: '🏥',
    subcategories: [
      { value: 'Chiropractic', label: 'Chiropractic' },
      { value: 'Clinic / Urgent Care', label: 'Clinic / Urgent Care' },
      { value: 'Dentist', label: 'Dentist' },
      { value: 'Doctor', label: 'Doctor' },
      { value: 'Gym / Fitness Center', label: 'Gym / Fitness Center' },
      { value: 'Home Health Care', label: 'Home Health Care' },
      { value: 'Hospital / Medical Center', label: 'Hospital / Medical Center' },
      { value: 'Medical Laboratory', label: 'Medical Laboratory' },
      { value: 'Mental Health / Counseling', label: 'Mental Health / Counseling' },
      { value: 'Optometrist / Eye Care', label: 'Optometrist / Eye Care' },
      { value: 'Other Health', label: 'Other Health' },
      { value: 'Pharmacy', label: 'Pharmacy' },
      { value: 'Physical Therapy', label: 'Physical Therapy' },
      { value: 'Spa / Wellness Center', label: 'Spa / Wellness Center' },
      { value: 'Veterinarian', label: 'Veterinarian' },
    ],
  },
  {
    value: 'Finance',
    label: 'Finance',
    icon: '💰',
    subcategories: [
      { value: 'Bank', label: 'Bank' },
      { value: 'Check Cashing / Money Services', label: 'Check Cashing / Money Services' },
      { value: 'Credit Union', label: 'Credit Union' },
      { value: 'Financial Advisor', label: 'Financial Advisor' },
      { value: 'Investment / Wealth Management', label: 'Investment / Wealth Management' },
      { value: 'Loan Lender', label: 'Loan Lender' },
      { value: 'Mortgage Lender', label: 'Mortgage Lender' },
      { value: 'Other Finance', label: 'Other Finance' },
    ],
  },
  {
    value: 'Food',
    label: 'Food',
    icon: '🍽',
    subcategories: [
      { value: 'Bakery', label: 'Bakery' },
      { value: 'Bar / Lounge', label: 'Bar / Lounge' },
      { value: 'Butcher Shop', label: 'Butcher Shop' },
      { value: 'Cafe / Coffee Shop', label: 'Cafe / Coffee Shop' },
      { value: 'Catering', label: 'Catering' },
      { value: 'Dessert Shop', label: 'Dessert Shop' },
      { value: 'Fast Food', label: 'Fast Food' },
      { value: 'Food Truck', label: 'Food Truck' },
      { value: 'Grocery / Market', label: 'Grocery / Market' },
      { value: 'Ice Cream Shop', label: 'Ice Cream Shop' },
      { value: 'Juice Bar', label: 'Juice Bar' },
      { value: 'Other Food Business', label: 'Other Food Business' },
      { value: 'Pizzeria', label: 'Pizzeria' },
      { value: 'Restaurant', label: 'Restaurant' },
      { value: 'Specialty / Ethnic Grocery', label: 'Specialty / Ethnic Grocery' },
    ],
  },
  {
    value: 'Real Estate',
    label: 'Real Estate',
    icon: '🏠',
    subcategories: [
      { value: 'Commercial Real Estate', label: 'Commercial Real Estate' },
      { value: 'Home Staging', label: 'Home Staging' },
      { value: 'Other Real Estate Services', label: 'Other Real Estate Services' },
      { value: 'Property Inspector', label: 'Property Inspector' },
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
      { value: 'Auto Parts Store', label: 'Auto Parts Store' },
      { value: 'Beauty Supply', label: 'Beauty Supply' },
      { value: 'Bookstore', label: 'Bookstore' },
      { value: 'Clothing Store', label: 'Clothing Store' },
      { value: 'Convenience Store', label: 'Convenience Store' },
      { value: 'Electronics Store', label: 'Electronics Store' },
      { value: 'Florist', label: 'Florist' },
      { value: 'Furniture Store', label: 'Furniture Store' },
      { value: 'Gift Shop', label: 'Gift Shop' },
      { value: 'Grocery Store', label: 'Grocery Store' },
      { value: 'Hardware Store', label: 'Hardware Store' },
      { value: 'Home Appliances', label: 'Home Appliances' },
      { value: 'Jewelry Store', label: 'Jewelry Store' },
      { value: 'Other Retail Store', label: 'Other Retail Store' },
      { value: 'Pet Store', label: 'Pet Store' },
      { value: 'Shoe Store', label: 'Shoe Store' },
      { value: 'Smoke Shop / Tobacco', label: 'Smoke Shop / Tobacco' },
      { value: 'Sporting Goods Store', label: 'Sporting Goods Store' },
      { value: 'Thrift / Consignment Store', label: 'Thrift / Consignment Store' },
      { value: 'Toy Store', label: 'Toy Store' },
      { value: 'Wine & Liquor Store', label: 'Wine & Liquor Store' },
    ],
  },
  {
    value: 'Services',
    label: 'Services',
    icon: '🔧',
    subcategories: [
      { value: 'Accounting', label: 'Accounting' },
      { value: 'Appliance Repair', label: 'Appliance Repair' },
      { value: 'Architect', label: 'Architect' },
      { value: 'Auto Body Shop', label: 'Auto Body Shop' },
      { value: 'Auto Detailing', label: 'Auto Detailing' },
      { value: 'Auto Repair', label: 'Auto Repair' },
      { value: 'Barber Shop', label: 'Barber Shop' },
      { value: 'Business Consulting', label: 'Business Consulting' },
      { value: 'Car Wash', label: 'Car Wash' },
      { value: 'Cleaning Service', label: 'Cleaning Service' },
      { value: 'Concrete / Masonry', label: 'Concrete / Masonry' },
      { value: 'Courier / Delivery Service', label: 'Courier / Delivery Service' },
      { value: 'Daycare / Childcare', label: 'Daycare / Childcare' },
      { value: 'Driving School', label: 'Driving School' },
      { value: 'Dry Cleaning / Laundry', label: 'Dry Cleaning / Laundry' },
      { value: 'Electrical', label: 'Electrical' },
      { value: 'Engineering Services', label: 'Engineering Services' },
      { value: 'Event Planning', label: 'Event Planning' },
      { value: 'Flooring / Carpet', label: 'Flooring / Carpet' },
      { value: 'Funeral Home', label: 'Funeral Home' },
      { value: 'Garage Door Service', label: 'Garage Door Service' },
      { value: 'General Contractor', label: 'General Contractor' },
      { value: 'Hair Salon', label: 'Hair Salon' },
      { value: 'Handyman', label: 'Handyman' },
      { value: 'Home Security / Alarm', label: 'Home Security / Alarm' },
      { value: 'HVAC', label: 'HVAC' },
      { value: 'Insurance Agency', label: 'Insurance Agency' },
      { value: 'Interior Design', label: 'Interior Design' },
      { value: 'IT Services', label: 'IT Services' },
      { value: 'Junk Removal', label: 'Junk Removal' },
      { value: 'Landscaping', label: 'Landscaping' },
      { value: 'Legal Services', label: 'Legal Services' },
      { value: 'Limousine / Chauffeur', label: 'Limousine / Chauffeur' },
      { value: 'Locksmith', label: 'Locksmith' },
      { value: 'Logistics / Freight', label: 'Logistics / Freight' },
      { value: 'Makeup Artist', label: 'Makeup Artist' },
      { value: 'Marketing Agency', label: 'Marketing Agency' },
      { value: 'Moving Company', label: 'Moving Company' },
      { value: 'Nail Salon', label: 'Nail Salon' },
      { value: 'Notary / Translation', label: 'Notary / Translation' },
      { value: 'Oil Change / Lube', label: 'Oil Change / Lube' },
      { value: 'Other Services', label: 'Other Services' },
      { value: 'Painting', label: 'Painting' },
      { value: 'Pest Control', label: 'Pest Control' },
      { value: 'Pet Grooming', label: 'Pet Grooming' },
      { value: 'Photography', label: 'Photography' },
      { value: 'Plumbing', label: 'Plumbing' },
      { value: 'Pool Service', label: 'Pool Service' },
      { value: 'Printing / Copy Shop', label: 'Printing / Copy Shop' },
      { value: 'Real Estate Agent', label: 'Real Estate Agent' },
      { value: 'Recruiting / Employment Agency', label: 'Recruiting / Employment Agency' },
      { value: 'Roofing', label: 'Roofing' },
      { value: 'Snow Removal', label: 'Snow Removal' },
      { value: 'Solar Installation', label: 'Solar Installation' },
      { value: 'Staffing Agency', label: 'Staffing Agency' },
      { value: 'Tailor / Alterations', label: 'Tailor / Alterations' },
      { value: 'Taxi / Rideshare', label: 'Taxi / Rideshare' },
      { value: 'Tax Services', label: 'Tax Services' },
      { value: 'Tire Shop', label: 'Tire Shop' },
      { value: 'Towing Service', label: 'Towing Service' },
      { value: 'Travel Agency', label: 'Travel Agency' },
      { value: 'Tree Service', label: 'Tree Service' },
      { value: 'Trucking Company', label: 'Trucking Company' },
      { value: 'Tutoring', label: 'Tutoring' },
      { value: 'Videography', label: 'Videography' },
      { value: 'Welding / Fabrication', label: 'Welding / Fabrication' },
      { value: 'Window & Glass', label: 'Window & Glass' },
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

export function isHealthCategory(value?: string | null): boolean {
  return getMainCategory(value) === 'Health';
}

export function isFinanceCategory(value?: string | null): boolean {
  return getMainCategory(value) === 'Finance';
}

/** All valid subcategory values (for imports and validation). */
export function allBusinessSubcategoryValues(): string[] {
  return BUSINESS_CATEGORIES.flatMap((c) => c.subcategories.map((s) => s.value));
}

/** Resolve a subcategory label/value to its main category, if known. */
export function getMainCategoryForSubcategory(subcategory?: string | null): string | null {
  const v = (subcategory || '').trim();
  if (!v) return null;
  for (const cat of BUSINESS_CATEGORIES) {
    if (cat.subcategories.some((s) => s.value === v)) return cat.value;
  }
  return null;
}

/** Subcategory-specific icons (falls back to parent category icon). */
const SUBCATEGORY_ICONS: Record<string, string> = {
  bakery: '🥐',
  'bar / lounge': '🍸',
  'butcher shop': '🥩',
  'cafe / coffee shop': '☕',
  catering: '🍱',
  'dessert shop': '🍰',
  'fast food': '🍔',
  'food truck': '🚚',
  'grocery / market': '🛒',
  'ice cream shop': '🍦',
  'juice bar': '🧃',
  pizzeria: '🍕',
  restaurant: '🍽️',
  'specialty / ethnic grocery': '🛒',
  'car dealer': '🚗',
  'truck dealer': '🚛',
  'boat dealer': '🚤',
  'motorcycle dealer': '🏍️',
  'rv / camper dealer': '🚐',
  'trailer dealer': '🚛',
  'atv / utv dealer': '🏎️',
  'heavy equipment dealer': '🚜',
  dentist: '🦷',
  doctor: '🩺',
  'clinic / urgent care': '🏥',
  'hospital / medical center': '🏥',
  pharmacy: '💊',
  veterinarian: '🐾',
  'gym / fitness center': '🏋️',
  'spa / wellness center': '💆',
  'optometrist / eye care': '👓',
  chiropractic: '🦴',
  'mental health / counseling': '🧠',
  'physical therapy': '🧘',
  'hair salon': '💇',
  'barber shop': '💈',
  'nail salon': '💅',
  'makeup artist': '💄',
  'beauty supply': '🧴',
  'auto repair': '🔧',
  'auto body shop': '🛠️',
  'auto detailing': '✨',
  'car wash': '🚿',
  'oil change / lube': '🛢️',
  'tire shop': '🛞',
  'towing service': '🚛',
  plumbing: '🔧',
  hvac: '❄️',
  electrical: '⚡',
  landscaping: '🌳',
  roofing: '🏠',
  painting: '🖌️',
  'pest control': '🐛',
  handyman: '🛠️',
  'cleaning service': '🧹',
  'moving company': '📦',
  'taxi / rideshare': '🚕',
  'limousine / chauffeur': '🚗',
  'courier / delivery service': '📦',
  'trucking company': '🚛',
  'logistics / freight': '📦',
  bank: '🏦',
  'credit union': '🏦',
  'loan lender': '💵',
  'mortgage lender': '🏠',
  'financial advisor': '📊',
  'real estate agency': '🏡',
  'real estate broker': '🏡',
  'real estate agent': '🔑',
  'property management': '🏢',
  'clothing store': '👕',
  'electronics store': '📱',
  florist: '💐',
  'furniture store': '🛋️',
  'jewelry store': '💎',
  'pet store': '🐾',
  'shoe store': '👟',
  bookstore: '📚',
  photography: '📷',
  videography: '🎥',
  daycare: '👶',
  'daycare / childcare': '👶',
  tutoring: '📚',
  'legal services': '⚖️',
  'insurance agency': '🛡️',
  'it services': '💻',
  'marketing agency': '📣',
  'travel agency': '✈️',
  'pet grooming': '🐶',
  locksmith: '🔑',
  'funeral home': '🕯️',
};

/**
 * Emoji icon for a business category or subcategory label / quick-filter key.
 */
export function getBusinessCategoryIcon(label: string | null | undefined): string {
  const raw = String(label || '').trim();
  if (!raw) return '🏷️';
  const lower = raw.toLowerCase();

  // Quick-filter keys used on the businesses map
  if (lower === 'restaurants' || lower === 'restaurant') return '🍽️';
  if (lower === 'dealerships' || lower === 'dealership') return '🚘';
  if (lower === 'auto_services' || lower === 'auto services') return '🔧';
  if (lower === 'home_services' || lower === 'home services') return '🏠';
  if (lower === 'transportation') return '🚚';
  if (lower === 'retail') return '🛍️';
  if (lower === 'beauty' || lower === 'health & beauty') return '💇';
  if (lower === 'all categories' || lower === 'all') return '🌐';

  const exactMain = BUSINESS_CATEGORIES.find(
    (c) => c.value.toLowerCase() === lower || c.label.toLowerCase() === lower
  );
  if (exactMain) return exactMain.icon;

  if (SUBCATEGORY_ICONS[lower]) return SUBCATEGORY_ICONS[lower]!;

  const parent = getMainCategoryForSubcategory(raw);
  if (parent) {
    const parentCat = BUSINESS_CATEGORIES.find((c) => c.value === parent);
    if (parentCat) return parentCat.icon;
  }

  // Fuzzy fallbacks
  if (lower.includes('restaurant') || lower.includes('food') || lower.includes('cafe') || lower.includes('pizza')) {
    return '🍽️';
  }
  if (lower.includes('dealer') || lower.includes('dealership')) return '🚘';
  if (lower.includes('salon') || lower.includes('barber') || lower.includes('beauty') || lower.includes('nail')) {
    return '💇';
  }
  if (lower.includes('health') || lower.includes('clinic') || lower.includes('doctor') || lower.includes('dental') || lower.includes('dentist')) {
    return '🏥';
  }
  if (lower.includes('finance') || lower.includes('bank') || lower.includes('loan') || lower.includes('credit')) {
    return '💰';
  }
  if (lower.includes('real estate') || lower.includes('property') || lower.includes('realtor')) return '🏠';
  if (lower.includes('retail') || lower.includes('store') || lower.includes('shop')) return '🛍️';
  if (lower.includes('auto') || lower.includes('repair') || lower.includes('mechanic') || lower.includes('service')) {
    return '🔧';
  }
  if (lower.includes('transport') || lower.includes('truck') || lower.includes('taxi') || lower.includes('moving') || lower.includes('delivery')) {
    return '🚚';
  }
  if (lower.includes('gym') || lower.includes('fitness')) return '🏋️';
  if (lower.includes('church') || lower.includes('mosque') || lower.includes('temple') || lower.includes('religious')) {
    return '🙏';
  }
  if (lower.includes('school') || lower.includes('education') || lower.includes('tutor')) return '🎓';
  if (lower.includes('hotel') || lower.includes('motel') || lower.includes('lodging')) return '🏨';

  return '🏷️';
}
