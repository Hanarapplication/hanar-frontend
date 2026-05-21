'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronDown, ChevronUp, Heart } from 'lucide-react';
import {
  dashboardFbCanvas,
  dashboardFbHeader,
  dashboardFbIconWrap,
  dashboardFbOuter,
  dashboardFbPanelShell,
  dashboardFbPanelTitle,
  dashboardFbPanelTrigger,
} from '@/components/DashboardInlineActions';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

export type DashboardFavoriteBusiness = {
  id: string;
  business_name: string | null;
  slug: string | null;
  category: string | null;
  subcategory?: string | null;
  logo_url?: string | null;
  address?: { city?: string; state?: string } | string | null;
};

export type DashboardFavoriteItem = {
  key: string;
  id: string;
  source: 'retail' | 'dealership' | 'individual';
  slug: string;
  title: string;
  price: string | number;
  image: string;
  location?: string;
};

function normalizeCategory(value?: string | null) {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'something_else' || normalized === 'other') return '';
  if (normalized === 'retails') return 'Retail';
  return value || '';
}

const getFavoriteItemHref = (item: DashboardFavoriteItem) => {
  const slug = String(item.slug || '').trim();
  if (slug) return `/marketplace/${encodeURIComponent(slug)}`;
  return `/marketplace/${item.source}-${item.id}`;
};

const getFavoriteBusinessHref = (biz: DashboardFavoriteBusiness) => {
  const slug = String(biz.slug || biz.id || '').trim();
  return slug ? `/business/${encodeURIComponent(slug)}` : '/businesses';
};

const getBusinessCityState = (biz: DashboardFavoriteBusiness) => {
  const addr = biz.address;
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  return [addr.city, addr.state].filter(Boolean).join(', ');
};

type DashboardFavoritesSectionProps = {
  loading: boolean;
  favoriteItems: DashboardFavoriteItem[];
  favoriteBusinesses: DashboardFavoriteBusiness[];
  onRemoveItem: (itemKey: string) => void;
  onRemoveBusiness: (businessId: string) => void;
  excludeBusinessId?: string | null;
  /** Renders inside Quick actions (no standalone section header/canvas). */
  embedded?: boolean;
};

export default function DashboardFavoritesSection({
  loading,
  favoriteItems,
  favoriteBusinesses,
  onRemoveItem,
  onRemoveBusiness,
  excludeBusinessId,
  embedded = false,
}: DashboardFavoritesSectionProps) {
  const { effectiveLang } = useLanguage();
  const [favoriteItemsExpanded, setFavoriteItemsExpanded] = useState(false);
  const [favoriteBusinessesExpanded, setFavoriteBusinessesExpanded] = useState(false);

  const groupedFavorites = useMemo(() => {
    const groups: Record<string, DashboardFavoriteBusiness[]> = {};
    favoriteBusinesses.forEach((biz) => {
      if (excludeBusinessId && biz.id === excludeBusinessId) return;
      const key = normalizeCategory(biz.subcategory || biz.category) || 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(biz);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [favoriteBusinesses, excludeBusinessId]);

  const favoriteBusinessCount = useMemo(
    () => groupedFavorites.reduce((sum, [, rows]) => sum + rows.length, 0),
    [groupedFavorites]
  );

  const panels = (
    <>
      <div className={dashboardFbPanelShell}>
        <button
          type="button"
          onClick={() => setFavoriteItemsExpanded((prev) => !prev)}
          className={dashboardFbPanelTrigger}
          aria-expanded={favoriteItemsExpanded}
        >
          <span className={dashboardFbIconWrap}>
            <Heart className="h-5 w-5 shrink-0" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className={dashboardFbPanelTitle}>{t(effectiveLang, 'Favorite Items')}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {!loading && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-gray-700 dark:text-gray-300">
                {favoriteItems.length}
              </span>
            )}
            {favoriteItemsExpanded ? (
              <ChevronUp className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            )}
          </span>
        </button>
        {favoriteItemsExpanded && (
          <div className="px-5 pb-5 pt-0">
            {loading ? (
              <p className="text-sm text-slate-500 dark:text-gray-400">{t(effectiveLang, 'Loading...')}</p>
            ) : favoriteItems.length === 0 ? (
              <div className="rounded-2xl bg-slate-100/80 p-6 text-center text-sm text-slate-500 dark:bg-gray-700/50 dark:text-gray-400">
                {t(effectiveLang, 'You have no favorite items yet. Browse the marketplace and add some.')}
              </div>
            ) : (
              <div className="max-h-[min(24rem,60vh)] space-y-3 overflow-y-auto pr-1">
                {favoriteItems.map((item) => (
                  <div
                    key={item.key}
                    className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-gray-600 dark:bg-gray-800"
                  >
                    <Link
                      href={getFavoriteItemHref(item)}
                      className="block h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-gray-700"
                    >
                      <img
                        src={item.image || '/placeholder.jpg'}
                        alt={item.title}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder.jpg';
                          e.currentTarget.onerror = null;
                        }}
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={getFavoriteItemHref(item)}
                        className="line-clamp-2 text-[15px] font-semibold text-slate-900 transition-colors hover:text-indigo-600 dark:text-gray-100 dark:hover:text-indigo-400"
                      >
                        {item.title}
                      </Link>
                      <p className="mt-0.5 text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {typeof item.price === 'number'
                          ? `$${Number(item.price).toLocaleString()}`
                          : item.price || '—'}
                      </p>
                      {item.location ? (
                        <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-gray-400">{item.location}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.key)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      aria-label={t(effectiveLang, 'Remove from favorites')}
                    >
                      <Heart className="h-4 w-4 fill-current" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`${dashboardFbPanelShell}${embedded ? '' : ' mt-3'}`}>
        <button
          type="button"
          onClick={() => setFavoriteBusinessesExpanded((prev) => !prev)}
          className={dashboardFbPanelTrigger}
          aria-expanded={favoriteBusinessesExpanded}
        >
          <span className={dashboardFbIconWrap}>
            <Building2 className="h-5 w-5 shrink-0" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className={dashboardFbPanelTitle}>{t(effectiveLang, 'Favorite Businesses')}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {!loading && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-gray-700 dark:text-gray-300">
                {favoriteBusinessCount}
              </span>
            )}
            {favoriteBusinessesExpanded ? (
              <ChevronUp className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            )}
          </span>
        </button>
        {favoriteBusinessesExpanded && (
          <div className="px-5 pb-5 pt-0">
            {loading ? (
              <p className="text-sm text-slate-500 dark:text-gray-400">{t(effectiveLang, 'Loading...')}</p>
            ) : favoriteBusinessCount === 0 ? (
              <div className="rounded-2xl bg-slate-100/80 p-6 text-center text-sm text-slate-500 dark:bg-gray-700/50 dark:text-gray-400">
                {t(
                  effectiveLang,
                  'You have no favorite businesses yet. Visit a business page and click the heart to add favorites.'
                )}
              </div>
            ) : (
              <div className="max-h-[min(24rem,60vh)] space-y-4 overflow-y-auto pr-1">
                {groupedFavorites.map(([category, categoryBusinesses]) => (
                  <div key={category}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
                      {category === 'Other' ? t(effectiveLang, 'Other') : category}
                    </p>
                    <div className="space-y-3">
                      {categoryBusinesses.map((biz) => {
                        const locationText = getBusinessCityState(biz);
                        return (
                          <div
                            key={biz.id}
                            className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-gray-600 dark:bg-gray-800"
                          >
                            <Link
                              href={getFavoriteBusinessHref(biz)}
                              className="block h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-gray-700"
                            >
                              <img
                                src={
                                  biz.logo_url ||
                                  'https://images.unsplash.com/photo-1557426272-fc91fdb8f385?w=200&auto=format&fit=crop'
                                }
                                alt={biz.business_name || ''}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src =
                                    'https://images.unsplash.com/photo-1557426272-fc91fdb8f385?w=200&auto=format&fit=crop';
                                  e.currentTarget.onerror = null;
                                }}
                              />
                            </Link>
                            <div className="min-w-0 flex-1">
                              <Link
                                href={getFavoriteBusinessHref(biz)}
                                className="line-clamp-2 text-[15px] font-semibold text-slate-900 transition-colors hover:text-indigo-600 dark:text-gray-100 dark:hover:text-indigo-400"
                              >
                                {biz.business_name || t(effectiveLang, 'Business')}
                              </Link>
                              {locationText ? (
                                <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-gray-400">
                                  {locationText}
                                </p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => onRemoveBusiness(biz.id)}
                              className="flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              aria-label={t(effectiveLang, 'Remove from favorites')}
                            >
                              <Heart className="h-4 w-4 fill-current" aria-hidden />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );

  if (embedded) {
    return (
      <div>
        <h3 className="mb-2 px-0.5 text-[15px] font-semibold text-[#050505] dark:text-gray-100">
          {t(effectiveLang, 'My Favorites')}
        </h3>
        <div className="space-y-3">{panels}</div>
      </div>
    );
  }

  return (
    <section className={dashboardFbOuter}>
      <div className={dashboardFbHeader}>
        <h2 className="text-[17px] font-bold leading-tight text-[#050505] dark:text-gray-100">
          {t(effectiveLang, 'My Favorites')}
        </h2>
      </div>
      <div className={dashboardFbCanvas}>{panels}</div>
    </section>
  );
}
