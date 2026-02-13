'use client';

import { Heart } from 'lucide-react';
import { useBusinessProfileTheme } from '../theme/ThemeProvider';
import { cn } from '@/lib/utils';
import type { BusinessProfileData } from '../types';

interface BusinessInfoCardProps {
  business: BusinessProfileData;
  displayCategory: string | null;
  isFavorited: boolean;
  onFavoriteToggle: () => void;
}

export function BusinessInfoCard({
  business,
  displayCategory,
  isFavorited,
  onFavoriteToggle,
}: BusinessInfoCardProps) {
  const theme = useBusinessProfileTheme();

  return (
    <div
      className="rounded-xl shadow-md overflow-hidden"
      style={{
        backgroundColor: theme.cardBg,
        boxShadow: theme.shadow,
        borderRadius: theme.radius,
      }}
    >
      <div className="p-4 sm:p-6">
        <div className="relative flex justify-between items-start flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {business.logo_url && (
              <div
                className="w-24 sm:w-28 h-24 sm:h-28 flex-shrink-0 rounded-xl overflow-hidden shadow-md"
                style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}` }}
              >
                <img
                  src={business.logo_url}
                  alt="Business Logo"
                  className="object-contain w-full h-full p-2"
                  onError={(e) => {
                    e.currentTarget.src = 'https://placehold.co/120x120/cccccc/333333?text=Logo';
                    e.currentTarget.onerror = null;
                  }}
                />
              </div>
            )}
            <div className="text-left flex-1 min-w-0">
              <h1
                className="text-2xl sm:text-3xl font-bold truncate"
                style={{ color: theme.text }}
              >
                {business.business_name}
              </h1>
              {displayCategory && (
                <span
                  className="inline-block mt-1 px-3 py-1.5 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: theme.primary,
                    color: theme.primaryText,
                  }}
                >
                  {displayCategory}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onFavoriteToggle}
            className={cn(
              'rounded-full p-2 shadow-md z-10 transition-colors',
              isFavorited ? 'text-red-500' : 'opacity-70 hover:text-red-500'
            )}
            style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}` }}
            aria-label={isFavorited ? 'Unfavorite' : 'Favorite'}
          >
            <Heart
              size={18}
              className={isFavorited ? 'fill-current' : ''}
              strokeWidth={isFavorited ? 0 : 2}
            />
          </button>
        </div>
        {business.description && (
          <p
            className="mt-2 font-normal leading-relaxed whitespace-pre-line text-sm"
            style={{ color: theme.mutedText }}
          >
            {business.description}
          </p>
        )}
      </div>
    </div>
  );
}
