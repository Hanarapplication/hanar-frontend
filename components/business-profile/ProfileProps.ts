import type { BusinessProfileData, ProfileListingsData, MenuItem, CarListing, RetailItem, RealEstateListing } from './types';

export interface GroupedMenuGroup {
  category: string;
  items: MenuItem[];
}

export type ProfileListingItem = MenuItem | CarListing | RetailItem | RealEstateListing;

export interface BusinessProfileRendererProps {
  business: BusinessProfileData;
  listings: ProfileListingsData;
  groupedMenu: GroupedMenuGroup[];
  isFavorited: boolean;
  selectedImageIndex: number;
  onImageIndexChange: (index: number) => void;
  onShare: () => void;
  onItemShare: (label: string) => void;
  onFavoriteToggle: () => void;
  getMapUrl: (address: import('./types').BusinessAddress) => string;
  onViewDetails: (type: 'menu' | 'car' | 'retail' | 'real_estate', item: ProfileListingItem) => void;
  onGalleryTouchStart?: (e: React.TouchEvent) => void;
  onGalleryTouchMove?: (e: React.TouchEvent) => void;
  onGalleryTouchEnd?: (e: React.TouchEvent) => void;
}
