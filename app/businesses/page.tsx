'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { FaSearch, FaHeart, FaRegHeart, FaMapMarkerAlt } from 'react-icons/fa';
import AddressAutocomplete, { type AddressResult } from '@/components/AddressAutocomplete';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';
import PullToRefresh from '@/components/PullToRefresh';
import {
  getDistanceMiles,
  readSavedSearchRadiusMiles,
  resolveLatLon,
  writeSavedSearchRadiusMiles,
} from '@/lib/geoDistance';

const BUSINESSES_CACHE_KEY = 'hanar_businesses_cache';
const BUSINESSES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function readBusinessesCache(): { ts: number; businesses: Business[] } | null {
  try {
    const raw = sessionStorage.getItem(BUSINESSES_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (Date.now() - cache.ts > BUSINESSES_CACHE_TTL) return null;
    return cache;
  } catch {
    return null;
  }
}

function writeBusinessesCache(businesses: Business[]) {
  try {
    sessionStorage.setItem(BUSINESSES_CACHE_KEY, JSON.stringify({ ts: Date.now(), businesses }));
  } catch {}
}

interface Business {
  id: string;
  business_name: string;
  category: string;
  subcategory?: string | null;
  address: any;
  description?: string;
  logo_url: string;
  slug: string;
  lat?: number;
  lon?: number;
  distance?: number;
  spoken_languages?: string[] | null;
  plan?: string | null;
}

function businessLatLon(b: Business) {
  return resolveLatLon({ lat: b.lat, lon: b.lon }, b.address);
}

const categoryColors: Record<string, string> = {
  Restaurant: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-700',
  'Car Dealership': 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-700',
  Dealership: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-700',
  Retail: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700',
  Cafe: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700',
  'Coffee Shop': 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700',
  'Hair Salon': 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-700',
  'Beauty Salon': 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-700',
  Gym: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700',
  Fitness: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700',
  'Pet Store': 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-900/40 dark:text-cyan-200 dark:border-cyan-700',
  Clinic: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-700',
  'Medical Center': 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-700',
  Shop: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-700',
  Store: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-700',
  default: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-700/50 dark:text-gray-200 dark:border-gray-600',
};

function formatBusinessCategory(value: string) {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'something_else' || normalized === 'other') return '';
  if (normalized === 'retails') return 'Retail';
  return value;
}

function toTitleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function formatStateLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  // Keep common state abbreviations fully uppercase (CA, NY, TX...)
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return toTitleCaseWords(trimmed);
}

function getCityState(address: any): string {
  if (!address) return 'Location not available';

  if (typeof address === 'string') {
    const parts = address.split(',').map((p: string) => p.trim());
    if (parts.length >= 2) {
      const potentialState = parts[parts.length - 1].split(' ')[0];
      const potentialCity = parts[parts.length - 2];
      if (potentialState.length <= 3 && /[A-Z]{2}/.test(potentialState)) {
        return `${toTitleCaseWords(potentialCity)}, ${potentialState.toUpperCase()}`;
      }
    }
    return toTitleCaseWords(address);
  }

  if (typeof address === 'object' && address !== null) {
    const city = address.city || address.town || address.locality || '';
    const state = address.state || address.state_code || address.province || address.region || '';
    if (city && state) return `${toTitleCaseWords(String(city))}, ${formatStateLabel(String(state))}`;
    if (city) return toTitleCaseWords(String(city));
    if (state) return formatStateLabel(String(state));
  }

  return 'Location not available';
}

export default function BusinessesPage() {
  const { effectiveLang } = useLanguage();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [relatedBusinessIds, setRelatedBusinessIds] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [radius, setRadius] = useState(() => readSavedSearchRadiusMiles(40));
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [tempRadius, setTempRadius] = useState(() => readSavedSearchRadiusMiles(40));
  const [locationSearchValue, setLocationSearchValue] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(6);
  const bottomRef = useRef<HTMLDivElement>(null);
  const servicesCarouselRef = useRef<HTMLDivElement>(null);
  const searchCacheRef = useRef<Map<string, Set<string>>>(new Map());
  const hasFetchedRef = useRef(false);

  const fetchBusinesses = async () => {
    const { data, error } = await supabase
      .from('businesses')
      .select('id, business_name, category, subcategory, address, description, logo_url, slug, lat, lon, spoken_languages, plan')
      .eq('moderation_status', 'active')
      .eq('is_archived', false)
      .neq('lifecycle_status', 'archived');

    if (error) {
      console.error('Supabase fetch error:', error);
      return;
    }
    setBusinesses(data || []);
    writeBusinessesCache(data || []);
  };

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const cache = readBusinessesCache();
    if (cache) {
      setBusinesses(cache.businesses);
    } else {
      fetchBusinesses();
    }
  }, []);

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setFavorites([]);
          return;
        }

        const { data, error } = await supabase
          .from('business_favorites')
          .select('business_id')
          .eq('user_id', user.id);

        if (error) throw error;
        const ids = (data || []).map((row: { business_id: string }) => row.business_id);
        setFavorites(ids);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load favorites');
      }
    };

    loadFavorites();
  }, []);

  const handleLocationSelect = (result: AddressResult) => {
    if (result.lat != null && result.lng != null) {
      const coords = { lat: result.lat, lon: result.lng };
      const label =
        [result.city, result.state, result.country].filter(Boolean).join(', ') ||
        result.formatted_address ||
        'Selected location';
      setUserCoords(coords);
      setLocationLabel(label);
      setLocationSearchValue(label);
      try {
        localStorage.setItem('userCoords', JSON.stringify(coords));
        if (label) localStorage.setItem('userLocationLabel', label);
      } catch {}
      window.dispatchEvent(new CustomEvent('location:updated', {
        detail: {
          ...coords,
          label,
          city: result.city,
          state: result.state,
          country: result.country,
          zip: result.zip,
        },
      }));
    }
  };

  const handleUseMyLocation = () => {
    const stored = localStorage.getItem('userCoords');
    if (stored) {
      try {
        const { lat, lon } = JSON.parse(stored);
        setUserCoords({ lat, lon });
        setLocationLabel('Your location');
        return;
      } catch { /* ignore */ }
    }
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void (async () => {
          const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          let city: string | undefined;
          let state: string | undefined;
          let country: string | undefined;
          let label = 'Your location';
          try {
            const res = await fetch(
              `/api/geocode/reverse?lat=${encodeURIComponent(coords.lat)}&lon=${encodeURIComponent(coords.lon)}`
            );
            const data = await res.json().catch(() => ({}));
            const address = data?.address || {};
            city =
              address.city ||
              address.town ||
              address.village ||
              address.hamlet ||
              '';
            state = address.state || address.county || '';
            country = address.country || '';
            const composed = [city, state, country].filter(Boolean).join(', ');
            label = composed || data?.display_name || label;
          } catch {
            // keep fallback label
          }

          setUserCoords(coords);
          setLocationLabel(label);
          setLocationSearchValue(label);
          try {
            localStorage.setItem('userCoords', JSON.stringify(coords));
            if (label) localStorage.setItem('userLocationLabel', label);
          } catch {}
          window.dispatchEvent(
            new CustomEvent('location:updated', {
              detail: { ...coords, label, city, state, country, radiusMiles: radius },
            })
          );
        })();
      },
      () => toast.error('Could not get your location.')
    );
  };

  useEffect(() => {
    const saved = localStorage.getItem('userCoords');
    let savedLabel: string | null = null;
    try { savedLabel = localStorage.getItem('userLocationLabel'); } catch {}
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { lat: number; lon: number };
        if (parsed?.lat != null && parsed?.lon != null) {
          setUserCoords(parsed);
          setLocationLabel(savedLabel || 'Your location');
        }
      } catch { /* ignore */ }
    }
    const handleLocationUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        lat?: number;
        lon?: number;
        label?: string;
        city?: string;
        state?: string;
        country?: string;
        radiusMiles?: number;
      } | undefined;
      if (detail?.lat != null && detail?.lon != null) {
        setUserCoords({ lat: detail.lat, lon: detail.lon });
        if (detail.label) {
          setLocationLabel(detail.label);
          setLocationSearchValue(detail.label);
        } else {
          const composed = [detail.city, detail.state, detail.country].filter(Boolean).join(', ');
          if (composed) {
            setLocationLabel(composed);
            setLocationSearchValue(composed);
          } else {
            setLocationLabel((prev) => prev ?? 'Your location');
          }
        }
      }
      if (detail?.radiusMiles != null) {
        setRadius(detail.radiusMiles);
        setTempRadius(detail.radiusMiles);
      }
    };
    window.addEventListener('location:updated', handleLocationUpdated);
    return () => window.removeEventListener('location:updated', handleLocationUpdated);
  }, []);

  useEffect(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      setRelatedBusinessIds(new Set());
      setSearching(false);
      setVisibleCount(6);
      return;
    }

    if (term.length < 2) {
      setRelatedBusinessIds(new Set());
      setSearching(false);
      setVisibleCount(6);
      return;
    }

    const cached = searchCacheRef.current.get(term);
    if (cached) {
      setRelatedBusinessIds(new Set(cached));
      setSearching(false);
      setVisibleCount(6);
      return;
    }

    setSearching(true);
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const likeTerm = `%${term}%`;
        const [menuRes, retailRes, carRes] = await Promise.all([
          supabase
            .from('menu_items')
            .select('business_id')
            .or(`name.ilike.${likeTerm},description.ilike.${likeTerm},category.ilike.${likeTerm}`)
            .limit(200),
          supabase
            .from('retail_items')
            .select('business_id')
            .or(`name.ilike.${likeTerm},description.ilike.${likeTerm},category.ilike.${likeTerm}`)
            .limit(200),
          supabase
            .from('dealerships')
            .select('business_id')
            .or(`title.ilike.${likeTerm},description.ilike.${likeTerm}`)
            .limit(200),
        ]);

        const ids = new Set<string>();
        if (!menuRes.error && menuRes.data) {
          menuRes.data.forEach((row: { business_id: string | null }) => {
            if (row.business_id) ids.add(row.business_id);
          });
        }
        if (!retailRes.error && retailRes.data) {
          retailRes.data.forEach((row: { business_id: string | null }) => {
            if (row.business_id) ids.add(row.business_id);
          });
        }
        if (!carRes.error && carRes.data) {
          carRes.data.forEach((row: { business_id: string | null }) => {
            if (row.business_id) ids.add(row.business_id);
          });
        }

        if (!cancelled) {
          searchCacheRef.current.set(term, ids);
          setRelatedBusinessIds(ids);
        }
      } catch (err) {
        console.error('Search lookup failed', err);
      } finally {
        if (!cancelled) {
          setSearching(false);
          setVisibleCount(6);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  const toggleFavorite = async (e: React.MouseEvent, businessId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Login required to favorite businesses.');
        return;
      }

      if (favorites.includes(businessId)) {
        const { error } = await supabase
          .from('business_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('business_id', businessId);
        if (error) throw error;
        setFavorites((prev) => prev.filter((id) => id !== businessId));
      } else {
        const { error } = await supabase
          .from('business_favorites')
          .insert({ user_id: user.id, business_id: businessId });
        if (error) throw error;
        setFavorites((prev) => [...prev, businessId]);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update favorite');
    }
  };

  const normalizedQuery = query.toLowerCase();
  const normalizeCategoryToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const businessCategoryLabel = (b: Business) => formatBusinessCategory(b.subcategory || b.category) || '';
  const matchesSelectedCategory = (b: Business, key: string | null) => {
    if (!key) return true;
    const category = normalizeCategoryToken(businessCategoryLabel(b));
    if (!category) return false;
    switch (key) {
      case 'restaurants':
        return category.includes('restaurant') || category.includes('cafe') || category.includes('coffee');
      case 'dealerships':
        return category.includes('dealership');
      case 'auto_services':
        return category.includes('auto') || category.includes('repair') || category.includes('mechanic');
      case 'home_services':
        return category.includes('home') || category.includes('clean') || category.includes('plumb') || category.includes('mover');
      case 'transportation':
        return category.includes('transport') || category.includes('mover') || category.includes('delivery');
      case 'retail':
        return category.includes('retail') || category.includes('shop') || category.includes('store');
      case 'beauty':
        return category.includes('beauty') || category.includes('salon') || category.includes('hair');
      default:
        return category === normalizeCategoryToken(key) || category.includes(normalizeCategoryToken(key));
    }
  };
  const speaksUserLang = (b: Business) => {
    const langs = b.spoken_languages;
    if (!langs || !Array.isArray(langs) || langs.length === 0) return false;
    return langs.includes(effectiveLang);
  };
  const isPremium = (b: Business) => (b.plan || '').toLowerCase() === 'premium';
  const cityFromLabel = (locationLabel || '').split(',')[0]?.trim().toLowerCase() || '';
  const filteredByCategoryAndQuery = businesses
    .filter((b) => {
      if (!matchesSelectedCategory(b, selectedCategoryFilter)) return false;
      if (normalizedQuery) {
        const matchesText =
          b.business_name.toLowerCase().includes(normalizedQuery) ||
          (b.category || '').toLowerCase().includes(normalizedQuery) ||
          (b.subcategory || '').toLowerCase().includes(normalizedQuery) ||
          (b.description || '').toLowerCase().includes(normalizedQuery) ||
          getCityState(b.address).toLowerCase().includes(normalizedQuery);
        if (!matchesText && !relatedBusinessIds.has(b.id)) return false;
      }
      return true;
    });

  const filtered = filteredByCategoryAndQuery
    .filter((b) => {
      if (userCoords) {
        const ll = businessLatLon(b);
        if (ll) {
          return getDistanceMiles(userCoords.lat, userCoords.lon, ll.lat, ll.lon) <= radius;
        }
        if (!cityFromLabel || cityFromLabel === 'your location') return false;
        const loc = `${getCityState(b.address)} ${typeof b.address === 'string' ? b.address : ''}`.toLowerCase();
        return new RegExp(`\\b${cityFromLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(loc);
      }
      return true;
    })
    .sort((a, b) => {
      if (userCoords) {
        const aLL = businessLatLon(a);
        const bLL = businessLatLon(b);
        if (aLL && bLL) {
          const aDist = getDistanceMiles(userCoords.lat, userCoords.lon, aLL.lat, aLL.lon);
          const bDist = getDistanceMiles(userCoords.lat, userCoords.lon, bLL.lat, bLL.lon);
          if (aDist !== bDist) return aDist - bDist;
        } else if (aLL && !bLL) return -1;
        else if (!aLL && bLL) return 1;
      }
      const aMatch = speaksUserLang(a);
      const bMatch = speaksUserLang(b);
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      if (aMatch && bMatch) {
        const aPrem = isPremium(a);
        const bPrem = isPremium(b);
        if (aPrem && !bPrem) return -1;
        if (!aPrem && bPrem) return 1;
      }
      return a.business_name.localeCompare(b.business_name);
    });

  const areaFilterActive = Boolean(userCoords) || (cityFromLabel.length > 0 && cityFromLabel !== 'your location');
  const nearbyFallbackBusinesses = areaFilterActive && filtered.length === 0
    ? filteredByCategoryAndQuery
        .map((b) => {
          const ll = businessLatLon(b);
          const distance =
            userCoords && ll ? getDistanceMiles(userCoords.lat, userCoords.lon, ll.lat, ll.lon) : null;
          return { business: b, distance };
        })
        .filter(({ business, distance }) => {
          if (userCoords && distance != null) return distance > radius;
          if (cityFromLabel && cityFromLabel !== 'your location') {
            const loc = `${getCityState(business.address)} ${typeof business.address === 'string' ? business.address : ''}`.toLowerCase();
            return !new RegExp(`\\b${cityFromLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(loc);
          }
          return true;
        })
        .sort((a, b) => {
          if (a.distance != null && b.distance != null) return a.distance - b.distance;
          if (a.distance != null && b.distance == null) return -1;
          if (a.distance == null && b.distance != null) return 1;
          return a.business.business_name.localeCompare(b.business.business_name);
        })
        .slice(0, 8)
        .map(({ business }) => business)
    : [];

  const visible = filtered.slice(0, visibleCount);
  const servicesShowcase = filtered.slice(0, 8);

  useEffect(() => {
    const carousel = servicesCarouselRef.current;
    if (!carousel || servicesShowcase.length < 2) return;

    const timer = window.setInterval(() => {
      const firstCard = carousel.querySelector<HTMLElement>('[data-service-card="true"]');
      const cardWidth = firstCard?.offsetWidth ?? 168;
      const gapPx = 12;
      const step = cardWidth + gapPx;
      const maxScrollLeft = carousel.scrollWidth - carousel.clientWidth;

      if (carousel.scrollLeft + step >= maxScrollLeft - 2) {
        carousel.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        carousel.scrollBy({ left: step, behavior: 'smooth' });
      }
    }, 2800);

    return () => window.clearInterval(timer);
  }, [servicesShowcase.length]);
  const quickFilters: Array<{ label: string; icon: string; key: string; more?: boolean }> = [
    { label: 'Restaurants', icon: '🍽️', key: 'restaurants' },
    { label: 'Dealerships', icon: '🚘', key: 'dealerships' },
    { label: 'Auto Services', icon: '🔧', key: 'auto_services' },
    { label: 'Home Services', icon: '🏠', key: 'home_services' },
    { label: 'Transportation', icon: '🚚', key: 'transportation' },
    { label: 'Retail', icon: '🛍️', key: 'retail' },
    { label: 'Health & Beauty', icon: '💇', key: 'beauty' },
    { label: 'More', icon: '⋯', key: 'more', more: true },
  ];
  const allBusinessCategories = Array.from(
    new Set(
      businesses
        .map((b) => businessCategoryLabel(b))
        .map((v) => v.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
  const quickFilterReserved = new Set(
    quickFilters.filter((f) => !f.more).map((f) => normalizeCategoryToken(f.label))
  );
  const moreCategories = allBusinessCategories.filter((name) => {
    const token = normalizeCategoryToken(name);
    if (!token) return false;
    if (quickFilterReserved.has(token)) return false;
    if (token.includes('restaurant') || token.includes('dealership')) return false;
    return true;
  });

  const handlePullRefresh = useCallback(async () => {
    try { sessionStorage.removeItem(BUSINESSES_CACHE_KEY); } catch {}
    setVisibleCount(6);
    await fetchBusinesses();
  }, []);

  const renderBusinessRow = (biz: Business) => {
    const displayCategory = formatBusinessCategory(biz.subcategory || biz.category);
    const locationText = getCityState(biz.address);
    const bizCoords = businessLatLon(biz);
    return (
      <Link
        key={biz.id}
        href={`/business/${biz.slug}`}
        className="group flex gap-3 px-3 py-3 transition hover:bg-slate-50"
      >
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
          <img
            src={biz.logo_url || `https://images.unsplash.com/photo-1557426272-fc91fdb8f385?w=800&auto=format&fit=crop`}
            alt={biz.business_name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 text-2xl font-semibold text-slate-900 group-hover:text-[#d32323]">
              {biz.business_name}
            </h3>
            <button
              onClick={(e) => toggleFavorite(e, biz.id)}
              className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-rose-500"
              aria-label="Toggle favorite"
            >
              {favorites.includes(biz.id) ? <FaHeart className="h-4 w-4 text-rose-500" /> : <FaRegHeart className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-0.5 text-sm font-medium text-[#d32323]">
            {'★'.repeat(isPremium(biz) ? 5 : 4)}
            <span className="ml-1 text-slate-500">{isPremium(biz) ? 'Premium' : 'New'}</span>
          </p>
          <p className="mt-1 line-clamp-1 text-lg text-slate-600">
            {[displayCategory, locationText === 'Location not available' ? t(effectiveLang, 'Location not available') : locationText]
              .filter(Boolean)
              .join(' • ')}
          </p>
          {userCoords && bizCoords && (
            <p className="mt-0.5 text-xs text-slate-500">
              {getDistanceMiles(userCoords.lat, userCoords.lon, bizCoords.lat, bizCoords.lon).toFixed(1)} mi away
            </p>
          )}
        </div>
      </Link>
    );
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && setVisibleCount((c) => c + 6),
      { threshold: 0.1 }
    );
    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [filtered]);

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pb-10 sm:pb-12">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8 pt-2 sm:pt-3">
        {/* Amazon-like search and location bar */}
        <div className="sticky top-0 z-10 -mx-3 mb-5 border-b border-sky-200/90 bg-gradient-to-b from-sky-100/95 to-white px-3 pb-3 pt-2 shadow-sm shadow-sky-900/10 sm:-mx-5 sm:mb-6 sm:px-5 dark:border-slate-700 dark:from-slate-900/80 dark:to-gray-800 dark:shadow-none">
          <div className="mx-auto max-w-3xl">
            <button
              type="button"
              onClick={() => { setLocationModalOpen(true); setTempRadius(radius); }}
              className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-sky-300/75 bg-gradient-to-r from-sky-300 via-sky-200 to-rose-300 px-3 py-1.5 text-[11px] font-medium text-sky-900 shadow-sm shadow-sky-900/10 transition hover:border-sky-400 hover:shadow-md dark:border-rose-900/35 dark:from-sky-950/60 dark:via-slate-900/50 dark:to-rose-950/50 dark:text-sky-100"
            >
              <FaMapMarkerAlt className="h-3.5 w-3.5 text-sky-700 dark:text-rose-300" />
              <span className="max-w-[11rem] truncate">{locationLabel || t(effectiveLang, 'Choose location')}</span>
              {locationLabel && (
                <span className="text-[10px] text-sky-800/80 dark:text-slate-400">{radius} mi</span>
              )}
            </button>

            <div className="flex overflow-hidden rounded-md border border-sky-300/75 bg-gradient-to-r from-sky-200 to-rose-200 shadow-sm shadow-sky-900/10 dark:border-slate-600 dark:from-slate-900/60 dark:to-rose-950/40 dark:shadow-none">
              <div className="hidden items-center border-r border-sky-200/90 bg-sky-50/90 px-3 text-[11px] font-medium text-sky-900 dark:border-sky-700 dark:bg-slate-800/80 dark:text-slate-200 sm:flex">
                All
              </div>
              <div className="relative min-w-0 flex-1">
                <input
                  placeholder={t(effectiveLang, 'Find a restaurant, salon, gym...')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                className="w-full border-0 bg-white py-2.5 pl-3 pr-14 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder:text-slate-400"
                />
                {searching && (
                  <span className="pointer-events-none absolute right-11 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 dark:text-slate-400">
                    {t(effectiveLang, 'Searching…')}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (query.trim()) setVisibleCount(6);
                }}
                className="inline-flex items-center justify-center bg-gradient-to-r from-sky-700 to-rose-700 px-4 text-white transition hover:from-sky-800 hover:to-rose-800 dark:from-sky-600 dark:to-rose-600 dark:hover:from-sky-700 dark:hover:to-rose-700"
                aria-label={t(effectiveLang, 'Search')}
              >
                <FaSearch className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Location modal – portal so always in view */}
        {locationModalOpen && typeof document !== 'undefined' && createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/35 backdrop-blur-[2px] p-3 pt-20 sm:pt-24"
            onClick={() => setLocationModalOpen(false)}
          >
            <div className="w-full max-w-sm rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-2xl ring-1 ring-black/5 backdrop-blur dark:border-gray-700/80 dark:bg-gray-900/95 sm:p-4.5" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t(effectiveLang, 'Search in this area')}</h3>
                <button
                  type="button"
                  onClick={() => setLocationModalOpen(false)}
                  className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  aria-label={t(effectiveLang, 'Close')}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{t(effectiveLang, 'Country, city or address')}</label>
                  <AddressAutocomplete
                    value={locationSearchValue}
                    onSelect={handleLocationSelect}
                    onChange={setLocationSearchValue}
                    placeholder="Search city, ZIP, or address..."
                    mode="locality"
                    className="w-full"
                    inputClassName="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-500/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-rose-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-rose-900/30"
                >
                  <FaMapMarkerAlt className="w-4 h-4 text-rose-500" />
                  {t(effectiveLang, 'Use my current location')}
                </button>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
                    {t(effectiveLang, 'Radius')}: {tempRadius} {t(effectiveLang, 'miles')}
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={tempRadius}
                    onChange={(e) => setTempRadius(Number(e.target.value))}
                    className="h-2 w-full appearance-none rounded-lg bg-slate-200 accent-rose-500 dark:bg-gray-600"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setLocationModalOpen(false)}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {t(effectiveLang, 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRadius(tempRadius);
                    writeSavedSearchRadiusMiles(tempRadius);
                    setLocationModalOpen(false);
                    setVisibleCount(6);
                  }}
                  className="flex-1 rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600"
                >
                  {t(effectiveLang, 'Apply')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {categoriesModalOpen && typeof document !== 'undefined' && createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/35 p-3 pt-20 backdrop-blur-[2px] sm:pt-24"
            onClick={() => setCategoriesModalOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-xl border border-[#d5d9d9] bg-white p-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-[#0f1111]">More categories</h3>
                <button
                  type="button"
                  onClick={() => setCategoriesModalOpen(false)}
                  className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close categories"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="max-h-[52vh] overflow-y-auto pr-1">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryFilter(null);
                      setCategoriesModalOpen(false);
                      setVisibleCount(6);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#d5d9d9] bg-[#e7f4f5] px-3 py-1 text-[11px] font-semibold text-[#007185] transition hover:border-[#c7caca] hover:bg-[#dff0f2]"
                  >
                    <span aria-hidden>🌐</span>
                    <span>All categories</span>
                  </button>
                  {moreCategories.map((category) => (
                    <button
                      key={`more-cat-${category}`}
                      type="button"
                      onClick={() => {
                        setSelectedCategoryFilter(category);
                        setCategoriesModalOpen(false);
                        setVisibleCount(6);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#d5d9d9] bg-[#f0f2f2] px-3 py-1 text-[11px] font-semibold text-[#0f1111] transition hover:border-[#c7caca] hover:bg-[#e7e9ec]"
                    >
                      <span>{category}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Yelp-style quick actions */}
        <section className="mb-6 rounded-none border-y border-slate-200 bg-white px-3 py-4">
          <div className="grid grid-cols-4 gap-y-3 sm:grid-cols-6">
            {quickFilters.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  if (item.more) {
                    setCategoriesModalOpen(true);
                  } else {
                    setSelectedCategoryFilter(item.key);
                    setQuery('');
                    setCategoriesModalOpen(false);
                  }
                  setVisibleCount(6);
                }}
                className="flex flex-col items-center justify-center gap-0.5 text-center"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-base">
                  {item.icon}
                </span>
                <span className={`text-[10px] font-medium leading-tight ${selectedCategoryFilter === item.key ? 'text-[#d32323]' : 'text-slate-700'}`}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Services & Professionals */}
        <section className="mb-6 rounded-none border-y border-slate-200 bg-white px-3 py-4">
          <h2 className="mb-3 text-3xl font-semibold text-slate-900 tracking-tight">
            Services &amp; Professionals
          </h2>
          <div
            ref={servicesCarouselRef}
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {servicesShowcase.map((biz) => (
              <Link
                key={`service-${biz.id}`}
                href={`/business/${biz.slug}`}
                className="group min-w-[10.5rem] max-w-[10.5rem] snap-start"
                data-service-card="true"
              >
                <div className="overflow-hidden rounded-xl bg-slate-100">
                  <img
                    src={biz.logo_url || `https://images.unsplash.com/photo-1557426272-fc91fdb8f385?w=800&auto=format&fit=crop`}
                    alt={biz.business_name}
                    loading="lazy"
                    decoding="async"
                    className="h-28 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <p className="mt-2 line-clamp-1 text-lg font-semibold text-slate-900">{formatBusinessCategory(biz.subcategory || biz.category) || 'Business'}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Yelp-style nearby list */}
        <section className="rounded-none border-y border-slate-200 bg-white">
          <div className="px-3 py-4">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Hot New Businesses Nearby</h2>
          </div>
          {areaFilterActive && filtered.length === 0 && (
            <div className="mx-3 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              No businesses found in your selected area. Here are similar businesses in nearby cities.
            </div>
          )}
          <div className="divide-y divide-slate-200">
            {(filtered.length > 0 ? visible : nearbyFallbackBusinesses).map((biz) => renderBusinessRow(biz))}
          </div>
        </section>

        <div ref={bottomRef} className="mt-8 sm:mt-10 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          {filtered.length > 0 && visible.length < filtered.length ? (
            <span className="inline-flex items-center gap-2">
              <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-rose-500 dark:border-t-rose-400"></div>
              {t(effectiveLang, 'Loading more...')}
            </span>
          ) : (
            filtered.length === 0
              ? (nearbyFallbackBusinesses.length > 0 ? t(effectiveLang, 'Showing nearby results') : t(effectiveLang, 'No matches found'))
              : t(effectiveLang, 'End of list')
          )}
        </div>
      </div>
    </div>
    </PullToRefresh>
  );
}