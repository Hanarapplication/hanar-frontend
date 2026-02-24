/**
 * Shared helpers for Google Places import.
 */

/** Map Google Place types to Hanar category + subcategory */
export function googleTypesToHanarCategory(
  types: string[] = []
): { category: string; subcategory: string } {
  const lower = types.map((t) => (t || '').toLowerCase());
  // Food
  if (lower.some((t) => ['restaurant', 'food', 'meal_delivery', 'meal_takeaway'].includes(t)))
    return { category: 'Food', subcategory: 'Restaurant' };
  if (lower.some((t) => ['cafe', 'coffee_shop'].includes(t)))
    return { category: 'Food', subcategory: 'Cafe / Coffee Shop' };
  if (lower.some((t) => ['bakery'].includes(t)))
    return { category: 'Food', subcategory: 'Bakery' };
  if (lower.some((t) => ['bar', 'liquor_store'].includes(t)))
    return { category: 'Food', subcategory: 'Other Food Business' };
  // Dealership
  if (lower.some((t) => ['car_dealer', 'car_rental', 'car_repair'].includes(t)))
    return { category: 'Dealership', subcategory: 'Car Dealer' };
  if (lower.some((t) => ['car_wash'].includes(t)))
    return { category: 'Dealership', subcategory: 'Other Dealership' };
  // Real Estate
  if (lower.some((t) => ['real_estate_agency', 'real_estate_agent', 'lodging'].includes(t)))
    return { category: 'Real Estate', subcategory: 'Real Estate Agency' };
  if (lower.some((t) => ['lawyer', 'attorney'].includes(t)))
    return { category: 'Services', subcategory: 'Legal Services' };
  if (lower.some((t) => ['accounting', 'accountant'].includes(t)))
    return { category: 'Services', subcategory: 'Accounting' };
  if (lower.some((t) => ['insurance_agency'].includes(t)))
    return { category: 'Services', subcategory: 'Insurance Agency' };
  if (lower.some((t) => ['hair_care', 'hair_salon'].includes(t)))
    return { category: 'Services', subcategory: 'Hair Salon' };
  if (lower.some((t) => ['beauty_salon', 'spa'].includes(t)))
    return { category: 'Retail', subcategory: 'Beauty Supply' };
  if (lower.some((t) => ['dentist', 'doctor', 'hospital', 'pharmacy', 'physiotherapist'].includes(t)))
    return { category: 'Services', subcategory: 'Other Services' };
  if (lower.some((t) => ['gym', 'health'].includes(t)))
    return { category: 'Services', subcategory: 'Other Services' };
  if (lower.some((t) => ['store', 'shopping_mall', 'clothing_store', 'convenience_store', 'electronics_store', 'furniture_store', 'home_goods_store', 'jewelry_store', 'pet_store', 'shoe_store'].includes(t)))
    return { category: 'Retail', subcategory: 'Other Retail Store' };
  if (lower.some((t) => ['supermarket', 'grocery'].includes(t)))
    return { category: 'Retail', subcategory: 'Grocery Store' };
  if (lower.some((t) => ['book_store'].includes(t)))
    return { category: 'Retail', subcategory: 'Bookstore' };
  if (lower.some((t) => ['gas_station'].includes(t)))
    return { category: 'Services', subcategory: 'Auto Repair' };
  if (lower.some((t) => ['plumber', 'electrician', 'locksmith', 'moving_company', 'roofing_contractor', 'painter'].includes(t)))
    return { category: 'Services', subcategory: 'Other Services' };
  if (lower.some((t) => ['florist'].includes(t)))
    return { category: 'Retail', subcategory: 'Other Retail Store' };
  return { category: 'Services', subcategory: 'Other Services' };
}

/** Parse formatted_address into structured address for Hanar */
export function parseFormattedAddress(
  formatted_address?: string | null
): { street: string; city: string; state: string; zip: string; country: string } | null {
  if (!formatted_address || typeof formatted_address !== 'string') return null;
  const parts = formatted_address.split(',').map((p) => p.trim());
  if (parts.length < 2)
    return { street: formatted_address, city: '', state: '', zip: '', country: '' };
  const country = parts[parts.length - 1] || '';
  const stateZip = parts[parts.length - 2] || '';
  const stateZipMatch = stateZip.match(/^([A-Za-z\s]+)\s*(\d{5}(?:-\d{4})?)?$/);
  const state = stateZipMatch ? (stateZipMatch[1] || '').trim() : stateZip;
  const zip = stateZipMatch?.[2] || '';
  const city = parts[parts.length - 3] || '';
  const street = parts.slice(0, Math.max(0, parts.length - 3)).join(', ') || '';
  return { street, city, state, zip, country };
}
