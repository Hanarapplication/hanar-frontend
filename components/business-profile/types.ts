/**
 * Shared types for business profile templates and components.
 */

export interface BusinessAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface BusinessProfileData {
  id: string;
  business_name: string;
  slug: string;
  category?: string | null;
  description: string;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  logo_url?: string | null;
  images?: string[];
  address?: BusinessAddress | null;
  hours?: string | Record<string, string> | null;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  twitter?: string | null;
  moderation_status?: string | null;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price?: string | number;
  images: string[];
  category?: string;
}

export interface CarListing {
  id: string;
  title: string;
  price: string;
  year: string;
  mileage: string;
  condition: string;
  images: string[];
  description?: string;
}

export interface RetailItem {
  id: string;
  name: string;
  price: string;
  description: string;
  images: string[];
  category: string;
}

export interface RealEstateListing {
  id: string;
  title: string;
  price: string;
  propertyType: string;
  address: string;
  description: string;
  images: string[];
}

export interface ProfileListingsData {
  menu: MenuItem[];
  carListings: CarListing[];
  retailItems: RetailItem[];
  realEstateListings: RealEstateListing[];
}

export interface ProfileHandlers {
  onShare: () => void;
  onItemShare: (label: string) => void;
  onFavoriteToggle: () => void;
  getMapUrl: (address: BusinessAddress) => string;
}
