'use client';

import { useEffect, useRef } from 'react';
import BusinessProfileLink from '@/components/BusinessProfileLink';
import { useKeenSlider } from 'keen-slider/react';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';
import { cn } from '@/lib/utils';

export type TrendingBusinessSlide = {
  id: string;
  business_name: string;
  slug: string;
  logo_url: string;
  category: string;
  subcategory?: string | null;
};

type TrendingBusinessesSlideshowProps = {
  businesses: TrendingBusinessSlide[];
  getBusinessHref: (biz: TrendingBusinessSlide) => string;
  formatCategoryLabel: (biz: TrendingBusinessSlide) => string;
};

const FALLBACK_LOGO =
  'https://images.unsplash.com/photo-1557426272-fc91fdb8f385?w=800&auto=format&fit=crop';

const AUTOPLAY_MS = 4500;

const SLIDER_OPTIONS = {
  drag: true,
  rubberband: true,
  mode: 'free-snap' as const,
  defaultAnimation: {
    duration: 600,
    easing: (t: number) => 1 - Math.pow(1 - t, 3),
  },
  slides: { perView: 2.35, spacing: 10 },
  breakpoints: {
    '(min-width: 480px)': { slides: { perView: 2.9, spacing: 10 } },
    '(min-width: 768px)': { slides: { perView: 3.6, spacing: 12 } },
    '(min-width: 1024px)': { slides: { perView: 4.4, spacing: 12 } },
  },
};

export default function TrendingBusinessesSlideshow({
  businesses,
  getBusinessHref,
  formatCategoryLabel,
}: TrendingBusinessesSlideshowProps) {
  const { effectiveLang } = useLanguage();
  const isDraggingRef = useRef(false);

  const [sliderRef, slider] = useKeenSlider({
    ...SLIDER_OPTIONS,
    loop: businesses.length > 1,
    dragStarted() {
      isDraggingRef.current = true;
    },
    dragEnded() {
      isDraggingRef.current = false;
    },
  });

  useEffect(() => {
    slider.current?.update();
  }, [businesses, slider]);

  useEffect(() => {
    if (businesses.length < 2) return;
    const timer = window.setInterval(() => {
      if (isDraggingRef.current) return;
      slider.current?.next();
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [slider, businesses.length]);

  if (businesses.length === 0) return null;

  return (
    <div
      ref={sliderRef}
      className="keen-slider cursor-grab overflow-visible active:cursor-grabbing touch-pan-y"
      aria-roledescription="carousel"
      aria-label={t(effectiveLang, 'Trending businesses')}
    >
      {businesses.map((biz) => (
        <BusinessProfileLink
          key={biz.id}
          href={getBusinessHref(biz)}
          data-keen-slider-clickable
          className={cn(
            'keen-slider__slide group block min-h-0 overflow-hidden rounded-2xl',
            'border border-slate-200/80 bg-slate-100 shadow-[0_6px_20px_rgba(0,0,0,0.2)]',
            'ring-1 ring-white/40 transition',
            'active:scale-[0.98] md:hover:bg-slate-50 md:hover:shadow-[0_8px_24px_rgba(0,0,0,0.28)]'
          )}
          data-no-translate
        >
          <div className="relative flex flex-col items-center px-2.5 pb-2.5 pt-3">
            <div className="relative">
              <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-white bg-slate-200 shadow-md ring-1 ring-slate-300/80">
                <img
                  src={biz.logo_url || FALLBACK_LOGO}
                  alt={biz.business_name || 'Business'}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="pointer-events-none h-full w-full object-cover"
                />
              </div>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-800 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow-sm">
                {t(effectiveLang, 'Premium')}
              </span>
            </div>
            <p className="mt-3 line-clamp-2 min-h-[2rem] w-full text-center text-[11px] font-bold leading-tight tracking-tight text-slate-900">
              {biz.business_name}
            </p>
            <p className="mt-0.5 line-clamp-1 w-full text-center text-[10px] font-medium text-slate-500">
              {formatCategoryLabel(biz)}
            </p>
          </div>
        </BusinessProfileLink>
      ))}
    </div>
  );
}
