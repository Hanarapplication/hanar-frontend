'use client';

import { Car, Calendar, Gauge, HeartHandshake, Store as StoreIcon, ClipboardList as ClipboardListIcon, Home, Eye } from 'lucide-react';
import { FaShareAlt } from 'react-icons/fa';
import { useBusinessProfileTheme } from '../theme/ThemeProvider';
import type { ProfileListingsData, MenuItem, CarListing, RetailItem, RealEstateListing } from '../types';

interface GroupedMenu {
  category: string;
  items: MenuItem[];
}

interface ListingsSectionProps {
  listings: ProfileListingsData;
  onViewDetails: (type: 'menu' | 'car' | 'retail' | 'real_estate', item: import('../ProfileProps').ProfileListingItem) => void;
  onItemShare: (label: string) => void;
  groupedMenu?: GroupedMenu[];
}

export function ListingsSection({
  listings,
  onViewDetails,
  onItemShare,
  groupedMenu = [],
}: ListingsSectionProps) {
  const theme = useBusinessProfileTheme();
  const { menu, carListings, retailItems, realEstateListings } = listings;
  const hasAny =
    menu.length > 0 ||
    carListings.length > 0 ||
    retailItems.length > 0 ||
    realEstateListings.length > 0;

  if (!hasAny) return null;

  const cardStyle = {
    backgroundColor: theme.cardBg,
    borderColor: theme.border,
    boxShadow: theme.shadow,
    borderRadius: theme.radius,
  };
  const btnPrimary = {
    backgroundColor: theme.primary,
    color: theme.primaryText,
  };

  return (
    <div
      className="rounded-xl p-4 sm:p-6 space-y-10"
      style={cardStyle}
    >
      {menu.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: theme.text }}>
            <ClipboardListIcon size={20} /> Menu
          </h2>
          <div className="space-y-6">
            {groupedMenu.map((group) => (
              <div key={group.category}>
                <h3 className="text-lg font-semibold mb-2" style={{ color: theme.primary }}>
                  {group.category}
                </h3>
                <div className="divide-y" style={{ borderColor: theme.border }}>
                  {group.items.map((item) => (
                    <div key={item.id} className="py-3 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium" style={{ color: theme.text }}>{item.name}</p>
                        {item.description && (
                          <p className="text-sm mt-0.5" style={{ color: theme.mutedText }}>{item.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.price != null && (
                          <span className="text-sm font-semibold" style={{ color: theme.primary }}>
                            ${item.price}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => onViewDetails('menu', item)}
                          className="px-3 py-1.5 text-sm rounded-md"
                          style={btnPrimary}
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => onItemShare(item.name)}
                          className="p-1.5 rounded-md border"
                          style={{ borderColor: theme.border, color: theme.text }}
                        >
                          <FaShareAlt size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {carListings.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: theme.text }}>
            <Car size={20} /> Car Listings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {carListings.map((car) => (
              <div key={car.id} className="overflow-hidden flex flex-col rounded-lg border" style={{ ...cardStyle, borderColor: theme.border }}>
                {car.images?.[0] && (
                  <div className="w-full h-36 sm:h-48 relative flex-shrink-0">
                    <img
                      src={car.images[0]}
                      alt={car.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://placehold.co/300x200/cccccc/333333?text=Car';
                        e.currentTarget.onerror = null;
                      }}
                    />
                  </div>
                )}
                <div className="p-4 flex flex-col flex-grow">
                  <h3 className="font-semibold text-lg" style={{ color: theme.text }}>{car.title}</h3>
                  <p className="font-bold mt-1" style={{ color: theme.primary }}>${car.price}</p>
                  <div className="text-sm mt-2 space-y-1" style={{ color: theme.mutedText }}>
                    <p className="flex items-center gap-1"><Calendar size={14} /> Year: {car.year}</p>
                    <p className="flex items-center gap-1"><Gauge size={14} /> Mileage: {car.mileage}</p>
                    <p className="flex items-center gap-1"><HeartHandshake size={14} /> Condition: {car.condition}</p>
                  </div>
                  <div className="mt-auto pt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onViewDetails('car', car)}
                      className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                      style={btnPrimary}
                    >
                      <Eye size={18} /> View Details
                    </button>
                    <button
                      type="button"
                      onClick={() => onItemShare(car.title)}
                      className="px-3 py-2.5 rounded-lg text-sm border flex items-center gap-2"
                      style={{ borderColor: theme.border, color: theme.text }}
                    >
                      <FaShareAlt size={16} /> Share
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {retailItems.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: theme.text }}>
            <StoreIcon size={20} /> Retail Items
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {retailItems.map((item) => (
              <div key={item.id} className="overflow-hidden flex flex-col rounded-lg border" style={{ ...cardStyle, borderColor: theme.border }}>
                {item.images?.[0] && (
                  <div className="w-full h-36 sm:h-48 relative flex-shrink-0">
                    <img
                      src={item.images[0]}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://placehold.co/300x200/cccccc/333333?text=Item';
                        e.currentTarget.onerror = null;
                      }}
                    />
                  </div>
                )}
                <div className="p-4 flex flex-col flex-grow">
                  <h3 className="font-semibold text-lg" style={{ color: theme.text }}>{item.name}</h3>
                  <p className="font-bold mt-1" style={{ color: theme.primary }}>{item.price}</p>
                  <p className="text-sm line-clamp-2 mt-1" style={{ color: theme.mutedText }}>{item.description}</p>
                  <div className="mt-auto pt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onViewDetails('retail', item)}
                      className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                      style={btnPrimary}
                    >
                      <Eye size={18} /> View Details
                    </button>
                    <button
                      type="button"
                      onClick={() => onItemShare(item.name)}
                      className="px-3 py-2.5 rounded-lg text-sm border flex items-center gap-2"
                      style={{ borderColor: theme.border, color: theme.text }}
                    >
                      <FaShareAlt size={16} /> Share
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {realEstateListings.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: theme.text }}>
            <Home size={20} /> Real Estate Listings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {realEstateListings.map((re) => (
              <div key={re.id} className="overflow-hidden flex flex-col rounded-lg border" style={{ ...cardStyle, borderColor: theme.border }}>
                {re.images?.[0] && (
                  <div className="w-full h-36 sm:h-48 relative flex-shrink-0">
                    <img
                      src={re.images[0]}
                      alt={re.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://placehold.co/300x200/cccccc/333333?text=Property';
                        e.currentTarget.onerror = null;
                      }}
                    />
                  </div>
                )}
                <div className="p-4 flex flex-col flex-grow">
                  <h3 className="font-semibold text-lg" style={{ color: theme.text }}>{re.title}</h3>
                  <p className="font-bold mt-1" style={{ color: theme.primary }}>{re.price ? `$${re.price}` : '—'}</p>
                  {re.propertyType && <p className="text-sm mt-1" style={{ color: theme.mutedText }}>{re.propertyType}</p>}
                  {re.address && <p className="text-sm line-clamp-1" style={{ color: theme.mutedText }}>{re.address}</p>}
                  <div className="mt-auto pt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onViewDetails('real_estate', re)}
                      className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                      style={btnPrimary}
                    >
                      <Eye size={18} /> View Details
                    </button>
                    <button
                      type="button"
                      onClick={() => onItemShare(re.title)}
                      className="px-3 py-2.5 rounded-lg text-sm border flex items-center gap-2"
                      style={{ borderColor: theme.border, color: theme.text }}
                    >
                      <FaShareAlt size={16} /> Share
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
