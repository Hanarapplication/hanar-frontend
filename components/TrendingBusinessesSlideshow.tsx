'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useKeenSlider } from 'keen-slider/react';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

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

export default function TrendingBusinessesSlideshow({
  businesses,
  getBusinessHref,
  formatCategoryLabel,
}: TrendingBusinessesSlideshowProps) {
  const { effectiveLang } = useLanguage();
  const [sliderRef, slider] = useKeenSlider({
    loop: businesses.length > 1,
    slides: { perView: 2.2, spacing: 8 },
    breakpoints: {
      '(min-width: 480px)': { slides: { perView: 2.8, spacing: 8 } },
      '(min-width: 768px)': { slides: { perView: 3.5, spacing: 10 } },
      '(min-width: 1024px)': { slides: { perView: 4.25, spacing: 10 } },
    },
  });

  useEffect(() => {
    if (businesses.length < 2) return;
    const timer = window.setInterval(() => {
      slider.current?.next();
    }, 4500);
    return () => window.clearInterval(timer);
  }, [slider, businesses.length]);

  if (businesses.length === 0) return null;

  return (
    <div ref={sliderRef} className="keen-slider overflow-hidden">
      {businesses.map((biz) => (
        <Link
          key={biz.id}
          href={getBusinessHref(biz)}
          data-keen-slider-clickable
          className="keen-slider__slide group block min-h-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
          data-no-translate
        >
          <div className="relative overflow-hidden bg-slate-100">
            <img
              src={biz.logo_url || FALLBACK_LOGO}
              alt={biz.business_name || 'Business'}
              loading="lazy"
              decoding="async"
              className="h-20 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-24"
            />
            <span className="absolute bottom-1.5 left-1.5 inline-flex items-center rounded-md border border-slate-200/80 bg-white/95 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-700 shadow-sm">
              {t(effectiveLang, 'Premium')}
            </span>
          </div>
          <div className="px-2 py-2">
            <p className="line-clamp-2 text-center text-xs font-semibold leading-tight text-slate-900">
              {biz.business_name}
            </p>
            <p className="mt-1 line-clamp-2 text-center text-[10px] font-medium leading-tight text-slate-500">
              {formatCategoryLabel(biz)}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
