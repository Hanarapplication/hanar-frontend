'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Gauge,
  Globe,
  Mail,
  Map as MapIcon,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  Search,
  ArrowUpDown,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { FaHeart, FaRegHeart, FaShareAlt } from 'react-icons/fa';
import { Megaphone, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContactHrefLink } from '@/components/ContactHrefLink';
import { buildMailtoHref, buildTelHref } from '@/lib/openContactUrl';
import { buildDirectionsUrl } from '@/lib/directionsUrl';
import { setBusinessesEnteredFromBusinessSlug } from '@/lib/businessesDirectoryNav';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import BusinessMap from '@/components/BusinessMap';
import ReportButton from '@/components/ReportButton';
import { BusinessDescriptionText } from '@/components/BusinessDescriptionText';
import { isBusinessNameLongForHeader } from '@/components/business-profile/utils';

export type DealershipCarListing = {
  id: string;
  title: string;
  price: string;
  year: string;
  mileage: string;
  condition: string;
  images: string[];
  description?: string;
};

export type DealershipBusinessData = {
  id: string;
  business_name: string;
  slug: string;
  description?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  logo_url?: string;
  images?: string[];
  owner_id?: string | null;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  hours?: string | Record<string, string>;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  twitter?: string;
  slug_primary_color?: string | null;
};

type DealershipBusinessProfileProps = {
  business: DealershipBusinessData;
  cars: DealershipCarListing[];
  carSearchQuery: string;
  onCarSearchQueryChange: (value: string) => void;
  carSort: string;
  onCarSortChange: (value: string) => void;
  sortOptions: { value: string; label: string }[];
  conditionFilter: string;
  onConditionFilterChange: (value: string) => void;
  conditionOptions: string[];
  visibleCarCount: number;
  accentColor?: string;
  contactActionColor?: string;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onShare: () => void;
  onOpenQr: () => void;
  onOpenCommunity?: () => void;
  onCarDetails: (car: DealershipCarListing) => void;
  onCarShare: (title: string) => void;
  formatPrice: (raw: string | number | undefined | null) => string;
  loadMoreRef?: React.RefObject<HTMLDivElement | null>;
  isLoadingMore?: boolean;
  carLoadMoreActive?: boolean;
};

function sanitizeHex(value: string | null | undefined, fallback: string): string {
  const v = String(value || '').trim();
  const normalized = v.startsWith('#') ? v : v ? `#${v}` : '';
  return /^#[0-9a-fA-F]{6}$/i.test(normalized) ? `#${normalized.slice(1).toLowerCase()}` : fallback;
}

function addressLine(address?: DealershipBusinessData['address']): string {
  if (!address) return '';
  return [address.street, address.city, address.state, address.zip].filter(Boolean).join(', ');
}

export default function DealershipBusinessProfile({
  business,
  cars,
  carSearchQuery,
  onCarSearchQueryChange,
  carSort,
  onCarSortChange,
  sortOptions,
  conditionFilter,
  onConditionFilterChange,
  conditionOptions,
  visibleCarCount,
  accentColor,
  contactActionColor,
  isFavorited,
  onToggleFavorite,
  onShare,
  onOpenQr,
  onOpenCommunity,
  onCarDetails,
  onCarShare,
  formatPrice,
  loadMoreRef,
  isLoadingMore,
  carLoadMoreActive,
}: DealershipBusinessProfileProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [typedDescription, setTypedDescription] = useState('');
  const [descriptionTypingDone, setDescriptionTypingDone] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);
  const heroInteractingRef = useRef(false);

  const brand = sanitizeHex(accentColor || business.slug_primary_color, '#1b4332');
  const actionColor = sanitizeHex(contactActionColor || accentColor || business.slug_primary_color, brand);
  const fullDescription = useMemo(
    () => (business.description || '').trim().replace(/\s+/g, ' '),
    [business.description]
  );
  const heroImages = useMemo(() => {
    const gallery = (business.images || []).filter(Boolean);
    if (gallery.length) return gallery;
    const fromCars = cars.map((c) => c.images?.[0]).filter(Boolean) as string[];
    if (fromCars.length) return fromCars.slice(0, 5);
    return ['https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&auto=format&fit=crop'];
  }, [business.images, cars]);

  const heroCount = heroImages.length;
  const goPrevHero = () => setHeroIndex((i) => (i - 1 + heroCount) % heroCount);
  const goNextHero = () => setHeroIndex((i) => (i + 1) % heroCount);

  const handleHeroTouchStart = (event: React.TouchEvent) => {
    if (heroCount <= 1) return;
    heroInteractingRef.current = true;
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    touchEndXRef.current = touchStartXRef.current;
  };
  const handleHeroTouchMove = (event: React.TouchEvent) => {
    touchEndXRef.current = event.touches[0]?.clientX ?? touchEndXRef.current;
  };
  const handleHeroTouchEnd = () => {
    if (touchStartXRef.current === null || touchEndXRef.current === null) {
      heroInteractingRef.current = false;
      return;
    }
    const deltaX = touchStartXRef.current - touchEndXRef.current;
    if (Math.abs(deltaX) > 50) {
      if (deltaX > 0) goNextHero();
      else goPrevHero();
    }
    touchStartXRef.current = null;
    touchEndXRef.current = null;
    heroInteractingRef.current = false;
  };

  useEffect(() => {
    if (heroCount <= 1) return;
    const timer = window.setInterval(() => {
      if (heroInteractingRef.current) return;
      setHeroIndex((i) => (i + 1) % heroCount);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [heroCount]);

  useEffect(() => {
    if (!fullDescription) {
      setTypedDescription('');
      setDescriptionTypingDone(false);
      return;
    }

    let cancelled = false;
    let index = 0;
    setTypedDescription('');
    setDescriptionTypingDone(false);

    const timer = window.setInterval(() => {
      if (cancelled) return;
      index += 1;
      setTypedDescription(fullDescription.slice(0, index));
      if (index >= fullDescription.length) {
        window.clearInterval(timer);
        setDescriptionTypingDone(true);
      }
    }, 65);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [fullDescription]);

  const promoImage =
    cars.find((c) => c.images?.[0])?.images?.[0] ||
    business.logo_url ||
    heroImages[0];

  const promoText = useMemo(() => {
    const desc = (business.description || '').trim().replace(/\s+/g, ' ');
    if (desc.length > 12) {
      return desc.length > 90 ? `${desc.slice(0, 87).trim()}…` : desc;
    }
    const place = [business.address?.city, business.address?.state].filter(Boolean).join(', ');
    return place
      ? `Quality trucks & vehicles ready for you in ${place}`
      : 'Quality trucks & vehicles ready for you';
  }, [business.description, business.address?.city, business.address?.state]);

  const mapsUrl =
    business.address && addressLine(business.address)
      ? buildDirectionsUrl(business.address)
      : null;

  const messageHref = business.owner_id
    ? `/messages?targetType=business&targetId=${encodeURIComponent(business.id)}`
    : null;

  const chatHref = business.whatsapp
    ? `https://wa.me/${business.whatsapp.replace(/[^\d+]/g, '')}`
    : null;

  const visibleCars = cars.slice(0, visibleCarCount);

  /** Long names crowd the hero header — relocate announcement into the contact row. */
  const nameIsLong = isBusinessNameLongForHeader(business.business_name);
  const showAnnouncementInHeader = Boolean(onOpenCommunity) && !nameIsLong;
  const showAnnouncementInContact = Boolean(onOpenCommunity) && nameIsLong;
  const showContactExtras = showAnnouncementInContact || (nameIsLong && Boolean(business.email));

  const actionBtnClass =
    'flex flex-col items-center gap-1.5 min-w-[4.25rem] active:scale-[0.97] transition [-webkit-tap-highlight-color:transparent]';
  const actionCircleClass =
    'flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_6px_18px_rgba(0,0,0,0.18)]';
  const contactChipClass =
    'inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 active:scale-[0.96]';
  const contactChipDivider = 'mx-0.5 h-5 w-px shrink-0 bg-slate-200';
  const headerChrome =
    'bg-slate-900/60 ring-1 ring-white/20 backdrop-blur-md shadow-sm';
  const headerIconBtn =
    `inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${headerChrome} transition hover:bg-slate-900/75`;

  return (
    <div className="relative min-h-screen bg-white text-slate-900">
      {/* Full-bleed hero */}
      <div
        className="relative h-[42vh] min-h-[16rem] max-h-[26rem] w-full overflow-hidden bg-slate-900 sm:h-[48vh]"
        onTouchStart={handleHeroTouchStart}
        onTouchMove={handleHeroTouchMove}
        onTouchEnd={handleHeroTouchEnd}
      >
        <img
          src={heroImages[heroIndex % heroImages.length]}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
          onError={(e) => {
            e.currentTarget.src =
              'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&auto=format&fit=crop';
            e.currentTarget.onerror = null;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/35" />

        {/* Overlay header + description */}
        <div className="absolute inset-x-0 top-0 z-20 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
          <header className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <Link
                href="/businesses"
                onClick={() => setBusinessesEnteredFromBusinessSlug()}
                className={headerIconBtn}
                aria-label="Back to businesses"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
              </Link>
              <div className={cn('flex min-w-0 max-w-full items-center gap-2 rounded-xl py-1 pl-1 pr-3', headerChrome)}>
                {business.logo_url ? (
                  <img
                    src={business.logo_url}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-md object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <h1
                  className="min-w-0 truncate text-[15px] font-bold tracking-tight text-white sm:text-base"
                  data-no-translate
                >
                  {business.business_name}
                </h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {showAnnouncementInHeader ? (
                <button
                  type="button"
                  onClick={() => onOpenCommunity?.()}
                  className={headerIconBtn}
                  aria-label="Announcements"
                >
                  <Megaphone className="h-4 w-4" strokeWidth={2.25} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={onOpenQr}
                className={headerIconBtn}
                aria-label="Show business QR code"
              >
                <QrCode className="h-4 w-4" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                onClick={onToggleFavorite}
                className={cn(headerIconBtn, isFavorited ? 'text-rose-400' : 'text-white')}
                aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              >
                {isFavorited ? <FaHeart className="h-4 w-4" /> : <FaRegHeart className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className={headerIconBtn}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" strokeWidth={2.25} />
              </button>
            </div>
          </header>

          {fullDescription ? (
            <div className="mt-2.5 rounded-2xl bg-slate-900/60 p-3 shadow-sm ring-1 ring-white/20 backdrop-blur-md">
              {descriptionTypingDone ? (
                <BusinessDescriptionText
                  text={fullDescription}
                  className="text-[13px] font-normal leading-relaxed text-white whitespace-pre-line [text-shadow:0_1px_2px_rgba(0,0,0,0.85),0_0_10px_rgba(0,0,0,0.45)]"
                  toggleClassName="text-white hover:text-white/85 dark:text-white dark:hover:text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.85)]"
                />
              ) : (
                <p className="text-[13px] font-normal leading-relaxed text-white whitespace-pre-line [text-shadow:0_1px_2px_rgba(0,0,0,0.85),0_0_10px_rgba(0,0,0,0.45)]">
                  {typedDescription}
                  <span
                    className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-white align-baseline animate-pulse"
                    aria-hidden
                  />
                </p>
              )}
            </div>
          ) : null}
        </div>

        {heroImages.length > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrevHero}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/30 backdrop-blur-sm transition hover:bg-black/55"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={goNextHero}
              aria-label="Next image"
              className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/30 backdrop-blur-sm transition hover:bg-black/55"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
            </button>
            <div className="absolute bottom-10 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
              {heroImages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setHeroIndex(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === heroIndex % heroImages.length ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
                  )}
                  aria-label={`Hero image ${i + 1}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* Overlapping white sheet */}
      <div className="relative z-10 -mt-8 rounded-t-[1.75rem] bg-white px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] sm:px-5">
        {/* Circular actions */}
        <div className="mb-5 flex items-start justify-around gap-1 px-1 sm:justify-center sm:gap-6">
          {business.phone ? (
            <ContactHrefLink href={buildTelHref(business.phone)} ariaLabel="Call" className={actionBtnClass}>
              <span className={actionCircleClass} style={{ backgroundColor: actionColor }}>
                <Phone className="h-6 w-6" strokeWidth={2.25} />
              </span>
              <span className="text-[12px] font-semibold text-slate-900">Call</span>
            </ContactHrefLink>
          ) : null}

          {chatHref ? (
            <a href={chatHref} target="_blank" rel="noopener noreferrer" className={actionBtnClass} aria-label="WhatsApp">
              <span className={actionCircleClass} style={{ backgroundColor: actionColor }}>
                <WhatsAppIcon className="h-6 w-6" strokeWidth={2.25} />
              </span>
              <span className="text-[12px] font-semibold text-slate-900">WhatsApp</span>
            </a>
          ) : null}

          {messageHref ? (
            <Link href={messageHref} className={actionBtnClass} aria-label="Message">
              <span className={actionCircleClass} style={{ backgroundColor: actionColor }}>
                <MessageCircle className="h-6 w-6" strokeWidth={2.25} />
              </span>
              <span className="text-[12px] font-semibold text-slate-900">Message</span>
            </Link>
          ) : null}

          {mapsUrl ? (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={actionBtnClass} aria-label="Map">
              <span className={actionCircleClass} style={{ backgroundColor: actionColor }}>
                <MapIcon className="h-6 w-6" strokeWidth={2.25} />
              </span>
              <span className="text-[12px] font-semibold text-slate-900">Map</span>
            </a>
          ) : null}
        </div>

        {showContactExtras ? (
          <div className="mb-4 flex justify-center">
            <div className="inline-flex items-center gap-0.5 rounded-full bg-white px-2 py-1.5 shadow-[0_10px_28px_rgba(15,23,42,0.14),0_2px_8px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80">
              {nameIsLong && business.email ? (
                <>
                  <ContactHrefLink
                    href={buildMailtoHref(business.email)}
                    ariaLabel="Email"
                    className={contactChipClass}
                  >
                    <Mail className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                  </ContactHrefLink>
                  {showAnnouncementInContact ? (
                    <span className={contactChipDivider} aria-hidden />
                  ) : null}
                </>
              ) : null}
              {showAnnouncementInContact ? (
                <button
                  type="button"
                  onClick={() => onOpenCommunity?.()}
                  aria-label="Announcements"
                  className={cn(contactChipClass, 'text-red-600 hover:text-red-700')}
                >
                  <Megaphone className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Promo banner */}
        {!((business.description || '').trim()) ? (
          <div
            className="mb-4 flex items-center gap-3 overflow-hidden rounded-2xl p-2.5 pr-3 shadow-sm"
            style={{ backgroundColor: brand }}
          >
            <img
              src={promoImage}
              alt=""
              className="h-16 w-20 shrink-0 rounded-xl object-cover ring-1 ring-white/20 sm:h-[4.5rem] sm:w-24"
              onError={(e) => {
                e.currentTarget.src =
                  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&auto=format&fit=crop';
                e.currentTarget.onerror = null;
              }}
            />
            <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-white sm:text-sm">
              {promoText}
            </p>
          </div>
        ) : null}

        {/* Search + sort / filter */}
        <div className="mb-4 space-y-2.5">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={carSearchQuery}
              onChange={(e) => onCarSearchQueryChange(e.target.value)}
              placeholder="Search vehicles"
              aria-label="Search vehicles"
              className="w-full rounded-full border-0 bg-slate-100 py-3 pl-10 pr-10 text-sm font-medium text-slate-900 outline-none ring-1 ring-slate-200/80 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-300"
            />
            {carSearchQuery ? (
              <button
                type="button"
                onClick={() => onCarSearchQueryChange('')}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200/70 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="relative">
            <ArrowUpDown
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <select
              id="dealership-car-sort"
              value={carSort}
              onChange={(e) => onCarSortChange(e.target.value)}
              aria-label="Sort vehicles"
              className="w-full appearance-none rounded-full border-0 bg-slate-100 py-3 pl-10 pr-10 text-sm font-medium text-slate-900 outline-none ring-1 ring-slate-200/80 focus:bg-white focus:ring-2 focus:ring-slate-300"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {conditionOptions.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => onConditionFilterChange('')}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                  !conditionFilter
                    ? 'text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80 hover:bg-slate-200/70'
                )}
                style={!conditionFilter ? { backgroundColor: brand } : undefined}
              >
                All
              </button>
              {conditionOptions.map((condition) => {
                const active = conditionFilter === condition;
                return (
                  <button
                    key={condition}
                    type="button"
                    onClick={() => onConditionFilterChange(active ? '' : condition)}
                    className={cn(
                      'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                      active
                        ? 'text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80 hover:bg-slate-200/70'
                    )}
                    style={active ? { backgroundColor: brand } : undefined}
                  >
                    {condition}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {carSearchQuery.trim() || conditionFilter || carSort !== 'default' ? (
          <p className="mb-3 text-xs font-medium text-slate-500">
            {cars.length} {cars.length === 1 ? 'vehicle' : 'vehicles'} found
          </p>
        ) : null}

        {/* Vehicle cards — 2 per row */}
        {visibleCars.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {visibleCars.map((car) => (
              <article
                key={car.id}
                className="flex flex-col overflow-hidden rounded-xl bg-white shadow-[0_6px_20px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80"
              >
                <button
                  type="button"
                  onClick={() => onCarDetails(car)}
                  className="block w-full flex-1 text-left"
                >
                  <div className="relative aspect-[4/3] w-full bg-slate-100">
                    <img
                      src={
                        car.images?.[0] ||
                        'https://placehold.co/800x500/e2e8f0/64748b?text=Vehicle'
                      }
                      alt={car.title}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src =
                          'https://placehold.co/800x500/e2e8f0/64748b?text=Vehicle';
                        e.currentTarget.onerror = null;
                      }}
                    />
                  </div>
                  <div className="p-2 sm:p-2.5">
                    <h3 className="line-clamp-2 text-[14px] font-bold leading-snug text-slate-900 sm:text-[15px]">
                      {car.title}
                    </h3>
                    <p className="mt-1 text-[14px] font-bold sm:text-[15px]" style={{ color: brand }}>
                      {formatPrice(car.price)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {car.year ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-medium text-slate-600 sm:text-[13px]">
                          <Calendar className="h-3.5 w-3.5" /> {car.year}
                        </span>
                      ) : null}
                      {car.mileage ? (
                        <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-medium text-slate-600 sm:text-[13px]">
                          <Gauge className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{car.mileage}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
                <div className="mt-auto flex gap-1.5 border-t border-slate-100 p-2 pt-2">
                  <button
                    type="button"
                    onClick={() => onCarDetails(car)}
                    className="flex-1 rounded-lg py-2 text-[13px] font-semibold text-white transition hover:brightness-110 sm:text-sm"
                    style={{ backgroundColor: brand }}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    onClick={() => onCarShare(car.title)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                    aria-label="Share vehicle"
                  >
                    <FaShareAlt className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 ring-1 ring-slate-200/80">
            {carSearchQuery.trim() || conditionFilter
              ? 'No vehicles match your filters.'
              : 'No vehicles in inventory yet.'}
          </p>
        )}

        {carLoadMoreActive ? (
          <div className="w-full pt-3">
            {isLoadingMore ? (
              <div className="flex justify-center py-4" aria-live="polite">
                <div
                  className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-transparent"
                  style={{ borderTopColor: brand }}
                />
              </div>
            ) : null}
            <div ref={loadMoreRef} className="h-8 w-full" aria-hidden />
          </div>
        ) : null}

        {/* Address / map */}
        {business.address?.street ? (
          <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-slate-200/90">
            <div className="flex items-center gap-2 px-3.5 py-3 text-sm font-medium text-slate-700">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <span data-no-translate>{addressLine(business.address)}</span>
            </div>
            <BusinessMap
              embedded
              address={business.address}
              businessId={business.id}
              businessName={business.business_name}
              logoUrl={business.logo_url}
            />
          </div>
        ) : null}
      </div>

      {/* Menu panel — thin, right side, half height */}
      {menuOpen ? (
        <div
          className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-[2px]"
          onClick={() => setMenuOpen(false)}
          role="presentation"
        >
          <div
            className="absolute right-0 top-0 flex max-h-[50vh] w-[min(13.5rem,78vw)] flex-col overflow-y-auto rounded-bl-2xl border-b border-l border-slate-200/80 bg-white px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-[-12px_8px_40px_rgba(15,23,42,0.18)] animate-[hanar-dealership-menu-in_0.24s_ease-out_both]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Business menu"
          >
            <div className="mb-1 flex justify-end">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-0.5 pb-1">
              <button
                type="button"
                onClick={() => {
                  onShare();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-semibold text-slate-800 hover:bg-slate-50"
              >
                <span>Share</span>
                <FaShareAlt className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              </button>
              {business.email ? (
                <ContactHrefLink
                  href={buildMailtoHref(business.email)}
                  ariaLabel="Email"
                  className="flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <span>Email</span>
                  <Mail className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                </ContactHrefLink>
              ) : null}
              {business.website ? (
                <a
                  href={
                    business.website.startsWith('http')
                      ? business.website
                      : `https://${business.website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <span>Website</span>
                  <Globe className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                </a>
              ) : null}
              <div className="pt-0.5">
                <ReportButton
                  entityType="business"
                  entityId={business.id}
                  entityTitle={business.business_name}
                  variant="text"
                  className="!flex !w-full !flex-row-reverse !items-center !justify-between !gap-2.5 !rounded-lg !px-2.5 !py-2.5 !text-[13px] !font-semibold !text-slate-800 !no-underline hover:!bg-slate-50 hover:!text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
