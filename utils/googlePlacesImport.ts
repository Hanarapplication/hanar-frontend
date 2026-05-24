/**
 * Shared helpers for Google Places import.
 */

/** Map Google Place types to Hanar category + subcategory */
export function googleTypesToHanarCategory(
  types: string[] = []
): { category: string; subcategory: string } {
  const lower = types.map((t) => (t || '').toLowerCase());

  // Food
  if (lower.some((t) => ['meal_delivery', 'meal_takeaway'].includes(t)))
    return { category: 'Food', subcategory: 'Fast Food' };
  if (lower.some((t) => ['restaurant', 'food'].includes(t)))
    return { category: 'Food', subcategory: 'Restaurant' };
  if (lower.some((t) => ['cafe', 'coffee_shop'].includes(t)))
    return { category: 'Food', subcategory: 'Cafe / Coffee Shop' };
  if (lower.some((t) => ['bakery'].includes(t)))
    return { category: 'Food', subcategory: 'Bakery' };
  if (lower.some((t) => ['bar', 'night_club'].includes(t)))
    return { category: 'Food', subcategory: 'Bar / Lounge' };
  if (lower.some((t) => ['liquor_store'].includes(t)))
    return { category: 'Retail', subcategory: 'Wine & Liquor Store' };

  // Dealership
  if (lower.some((t) => ['car_dealer'].includes(t)))
    return { category: 'Dealership', subcategory: 'Car Dealer' };
  if (lower.some((t) => ['car_rental'].includes(t)))
    return { category: 'Dealership', subcategory: 'Other Dealership' };

  // Real Estate
  if (lower.some((t) => ['real_estate_agency', 'real_estate_agent'].includes(t)))
    return { category: 'Real Estate', subcategory: 'Real Estate Agency' };
  if (lower.some((t) => ['lodging', 'hotel'].includes(t)))
    return { category: 'Real Estate', subcategory: 'Property Management' };

  // Finance
  if (lower.some((t) => ['bank'].includes(t)))
    return { category: 'Finance', subcategory: 'Bank' };
  if (lower.some((t) => ['atm', 'finance'].includes(t)))
    return { category: 'Finance', subcategory: 'Loan Lender' };
  if (lower.some((t) => ['accounting', 'accountant'].includes(t)))
    return { category: 'Services', subcategory: 'Accounting' };
  if (lower.some((t) => ['insurance_agency'].includes(t)))
    return { category: 'Services', subcategory: 'Insurance Agency' };

  // Legal & professional
  if (lower.some((t) => ['lawyer', 'attorney'].includes(t)))
    return { category: 'Services', subcategory: 'Legal Services' };

  // Beauty
  if (lower.some((t) => ['hair_care', 'hair_salon'].includes(t)))
    return { category: 'Services', subcategory: 'Hair Salon' };
  if (lower.some((t) => ['beauty_salon'].includes(t)))
    return { category: 'Services', subcategory: 'Nail Salon' };
  if (lower.some((t) => ['spa'].includes(t)))
    return { category: 'Health', subcategory: 'Spa / Wellness Center' };
  if (lower.some((t) => ['barber_shop'].includes(t)))
    return { category: 'Services', subcategory: 'Barber Shop' };

  // Health
  if (lower.includes('dentist'))
    return { category: 'Health', subcategory: 'Dentist' };
  if (lower.includes('doctor') || lower.includes('primary_care'))
    return { category: 'Health', subcategory: 'Doctor' };
  if (lower.some((t) => ['hospital'].includes(t)))
    return { category: 'Health', subcategory: 'Hospital / Medical Center' };
  if (lower.some((t) => ['pharmacy', 'drugstore'].includes(t)))
    return { category: 'Health', subcategory: 'Pharmacy' };
  if (lower.some((t) => ['physiotherapist', 'physician'].includes(t)))
    return { category: 'Health', subcategory: 'Physical Therapy' };
  if (lower.some((t) => ['veterinary_care'].includes(t)))
    return { category: 'Health', subcategory: 'Veterinarian' };
  if (lower.some((t) => ['health', 'medical_clinic'].includes(t)))
    return { category: 'Health', subcategory: 'Clinic / Urgent Care' };

  // Fitness
  if (lower.some((t) => ['gym', 'fitness_center'].includes(t)))
    return { category: 'Health', subcategory: 'Gym / Fitness Center' };

  // Auto services
  if (lower.some((t) => ['car_repair', 'car_service'].includes(t)))
    return { category: 'Services', subcategory: 'Auto Repair' };
  if (lower.some((t) => ['car_wash'].includes(t)))
    return { category: 'Services', subcategory: 'Car Wash' };
  if (lower.some((t) => ['gas_station'].includes(t)))
    return { category: 'Services', subcategory: 'Auto Repair' };

  // Home & trade services
  if (lower.some((t) => ['plumber'].includes(t)))
    return { category: 'Services', subcategory: 'Plumbing' };
  if (lower.some((t) => ['electrician'].includes(t)))
    return { category: 'Services', subcategory: 'Electrical' };
  if (lower.some((t) => ['locksmith'].includes(t)))
    return { category: 'Services', subcategory: 'Locksmith' };
  if (lower.some((t) => ['moving_company'].includes(t)))
    return { category: 'Services', subcategory: 'Moving Company' };
  if (lower.some((t) => ['roofing_contractor'].includes(t)))
    return { category: 'Services', subcategory: 'Roofing' };
  if (lower.some((t) => ['painter'].includes(t)))
    return { category: 'Services', subcategory: 'Painting' };
  if (lower.some((t) => ['general_contractor'].includes(t)))
    return { category: 'Services', subcategory: 'General Contractor' };
  if (lower.some((t) => ['pest_control'].includes(t)))
    return { category: 'Services', subcategory: 'Pest Control' };
  if (lower.some((t) => ['laundry'].includes(t)))
    return { category: 'Services', subcategory: 'Dry Cleaning / Laundry' };

  // Retail
  if (lower.some((t) => ['florist'].includes(t)))
    return { category: 'Retail', subcategory: 'Florist' };
  if (lower.some((t) => ['hardware_store'].includes(t)))
    return { category: 'Retail', subcategory: 'Hardware Store' };
  if (lower.some((t) => ['shoe_store'].includes(t)))
    return { category: 'Retail', subcategory: 'Shoe Store' };
  if (lower.some((t) => ['supermarket', 'grocery_or_supermarket', 'grocery'].includes(t)))
    return { category: 'Retail', subcategory: 'Grocery Store' };
  if (lower.some((t) => ['book_store'].includes(t)))
    return { category: 'Retail', subcategory: 'Bookstore' };
  if (lower.some((t) => ['store', 'shopping_mall', 'clothing_store', 'convenience_store', 'electronics_store', 'furniture_store', 'home_goods_store', 'jewelry_store', 'pet_store'].includes(t)))
    return { category: 'Retail', subcategory: 'Other Retail Store' };

  // Childcare & education
  if (lower.some((t) => ['school', 'primary_school', 'secondary_school'].includes(t)))
    return { category: 'Services', subcategory: 'Tutoring' };
  if (lower.some((t) => ['child_care_agency', 'day_care'].includes(t)))
    return { category: 'Services', subcategory: 'Daycare / Childcare' };

  // Transportation
  if (lower.some((t) => ['taxi_stand', 'travel_agency'].includes(t)))
    return { category: 'Services', subcategory: 'Travel Agency' };

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
