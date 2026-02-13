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

/** Prestige: same as Brand with more spacing and emphasis on hero. */
export function PrestigeTemplate(props: BusinessProfileRendererProps) {
  const { business, listings, groupedMenu, isFavorited, selectedImageIndex, onImageIndexChange } = props;
  const displayCategory = formatBusinessCategory(business.category);
  const hasAddress = business.address?.street;

  return (
    <div className="w-full space-y-6">
      <div className="relative left-1/2 -translate-x-1/2 w-screen max-w-none lg:static lg:left-0 lg:translate-x-0 lg:w-full lg:rounded-2xl lg:overflow-hidden">
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

      <BusinessInfoCard
        business={business}
        displayCategory={displayCategory}
        isFavorited={isFavorited}
        onFavoriteToggle={props.onFavoriteToggle}
      />

      <HoursCard business={business} />
      <SocialsCard business={business} />

      {hasAddress && (
        <div className="rounded-2xl p-6 space-y-4">
          <DirectionsButton address={business.address!} getMapUrl={props.getMapUrl} />
          <AddressCard address={business.address!} getMapUrl={props.getMapUrl} />
          <hr className="my-4 border" style={{ borderColor: 'var(--bp-border)' }} />
          <MapPreview address={business.address!} />
        </div>
      )}

      <ListingsSection
        listings={listings}
        onViewDetails={props.onViewDetails}
        onItemShare={props.onItemShare}
        groupedMenu={groupedMenu}
      />

      <ReviewsSection businessId={business.id} />
    </div>
  );
}
