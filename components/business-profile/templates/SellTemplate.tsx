'use client';

import {
  ProfileHeroCarousel,
  ActionIconRow,
  BusinessInfoCard,
  HoursCard,
  SocialsCard,
  DirectionsButton,
  AddressCard,
  MapPreview,
  ListingsSection,
  ReviewsSection,
} from '../shared';
import type { BusinessProfileRendererProps } from '../ProfileProps';
import { formatBusinessCategory } from '../utils';

/** Sell-focused: listings appear right after hero and actions. */
export function SellTemplate(props: BusinessProfileRendererProps) {
  const { business, listings, groupedMenu, isFavorited, selectedImageIndex, onImageIndexChange } = props;
  const displayCategory = formatBusinessCategory(business.subcategory || business.category);
  const hasAddress = business.address?.street;
  const hasListings =
    listings.menu.length > 0 ||
    listings.carListings.length > 0 ||
    listings.retailItems.length > 0 ||
    listings.realEstateListings.length > 0;

  return (
    <div className="w-full space-y-0">
      <div className="relative left-1/2 -translate-x-1/2 w-screen max-w-none lg:static lg:left-0 lg:translate-x-0 lg:w-full lg:rounded-xl lg:overflow-hidden">
        <ProfileHeroCarousel
          business={business}
          selectedIndex={selectedImageIndex}
          onIndexChange={onImageIndexChange}
          onTouchStart={props.onGalleryTouchStart}
          onTouchMove={props.onGalleryTouchMove}
          onTouchEnd={props.onGalleryTouchEnd}
        />
        <ActionIconRow business={business} onShare={props.onShare} />
      </div>

      {hasListings && (
        <ListingsSection
          listings={listings}
          onViewDetails={props.onViewDetails}
          onItemShare={props.onItemShare}
          groupedMenu={groupedMenu}
        />
      )}

      <BusinessInfoCard
        business={business}
        displayCategory={displayCategory}
        isFavorited={isFavorited}
        onFavoriteToggle={props.onFavoriteToggle}
      />

      <HoursCard business={business} />
      <SocialsCard business={business} />

      {hasAddress && (
        <div className="rounded-xl p-4 sm:p-6 space-y-3">
          <DirectionsButton address={business.address!} getMapUrl={props.getMapUrl} />
          <AddressCard address={business.address!} getMapUrl={props.getMapUrl} />
          <hr className="my-4 border" style={{ borderColor: 'var(--bp-border)' }} />
          <MapPreview address={business.address!} />
        </div>
      )}

      <ReviewsSection businessId={business.id} />
    </div>
  );
}
