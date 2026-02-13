'use client';

import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useBusinessProfileTheme } from '../theme/ThemeProvider';
import { cn } from '@/lib/utils';
import type { BusinessProfileData } from '../types';

interface ProfileHeroCarouselProps {
  business: BusinessProfileData;
  selectedIndex: number;
  onIndexChange: (index: number) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
}

export function ProfileHeroCarousel({
  business,
  selectedIndex,
  onIndexChange,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: ProfileHeroCarouselProps) {
  const theme = useBusinessProfileTheme();
  const images = business.images && business.images.length > 0 ? business.images : [];
  const hasMultiple = images.length > 1;

  const prev = () => onIndexChange(selectedIndex === 0 ? images.length - 1 : selectedIndex - 1);
  const next = () => onIndexChange(selectedIndex >= images.length - 1 ? 0 : selectedIndex + 1);

  if (images.length === 0) {
    return (
      <div
        className="w-full aspect-video lg:aspect-auto lg:h-[420px] flex items-center justify-center rounded-xl"
        style={{ backgroundColor: theme.border }}
      >
        <span className="text-sm" style={{ color: theme.mutedText }}>
          No images
        </span>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden w-full aspect-video lg:aspect-auto lg:h-[420px] flex items-center justify-center group rounded-xl"
      style={{ backgroundColor: theme.border }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <img
        src={images[selectedIndex]}
        alt={`Slide ${selectedIndex + 1}`}
        className="w-full h-full object-cover transition-transform duration-500"
        onError={(e) => {
          e.currentTarget.src = 'https://placehold.co/600x400/cccccc/333333?text=Image+Not+Available';
          e.currentTarget.onerror = null;
        }}
      />
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute top-1/2 left-4 -translate-y-1/2 rounded-full shadow p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white/90"
            aria-label="Previous image"
          >
            <ChevronLeft size={20} style={{ color: theme.text }} />
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute top-1/2 right-4 -translate-y-1/2 rounded-full shadow p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white/90"
            aria-label="Next image"
          >
            <ChevronRight size={20} style={{ color: theme.text }} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                className={cn(
                  'w-3 h-3 rounded-full transition-colors cursor-pointer',
                  i === selectedIndex ? '' : 'opacity-50'
                )}
                style={{
                  backgroundColor: i === selectedIndex ? theme.primary : theme.border,
                }}
                onClick={() => onIndexChange(i)}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
