'use client';

import {
  ProfileHeroCarousel,
  ActionIconRow,
  BusinessInfoCard,
  HoursCard,
  DirectionsButton,
  AddressCard,
  MapPreview,
  ListingsSection,
} from '../shared';
import type { BusinessProfileRendererProps } from '../ProfileProps';
import { formatBusinessCategory } from '../utils';

/** Simple: minimal layout, no socials card, compact. */
export function SimpleTemplate(props: BusinessProfileRendererProps) {
  const { business, listings, groupedMenu, isFavorited, selectedImageIndex, onImageIndexChange } = props;
  const displayCategory = formatBusinessCategory(business.category);
  const hasAddress = business.address?.street;

  return (
    <div className="w-full space-y-0 max-w-2xl mx-auto">
      <div className="rounded-xl overflow-hidden">
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

      {hasAddress && (
        <div className="rounded-xl p-4 space-y-2">
          <DirectionsButton address={business.address!} getMapUrl={props.getMapUrl} />
          <AddressCard address={business.address!} getMapUrl={props.getMapUrl} />
          <hr className="my-3 border" style={{ borderColor: 'var(--bp-border)' }} />
          <MapPreview address={business.address!} />
        </div>
      )}

      <ListingsSection
        listings={listings}
        onViewDetails={props.onViewDetails}
        onItemShare={props.onItemShare}
        groupedMenu={groupedMenu}
      />
    </div>
  );
}
