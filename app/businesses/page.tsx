'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { LayoutGrid, List, Navigation, Sparkles, TrendingUp, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MapPanelBusiness } from '@/components/BusinessesMapPanel';
import TrendingBusinessesSlideshow from '@/components/TrendingBusinessesSlideshow';
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
import {
  addressGeocodeQueryFromTable,
  geocodeAddressQuery,
  geocodeLocationAreaQuery,
  normalizeAddressInput,
  readGeocodeCache,
  resolveBusinessCoords,
  writeGeocodeCache,
  USA_MAP_CENTER,
  type GeocodeCache,
} from '@/lib/businessMapCoords';
import { isValidMapAreaBounds, type MapAreaBounds, type MapAreaScopeLevel } from '@/lib/mapAreaBounds';
import { hasValidAreaRings, type MapAreaRing } from '@/lib/mapAreaPolygon';
import { requestLocationWithFallback, readStoredCoords } from '@/lib/getBrowserLocation';
import { normalizeAvatarUrl } from '@/lib/avatarUrl';
import {
  itemMatchesCityFilter,
  itemMatchesCountryFilter,
  itemMatchesStateFilter,
  scopeFromAddressResult,
  type MarketplaceLocationScope,
} from '@/lib/marketplaceLocationFilter';

const BusinessesMapPanel = dynamic(() => import('@/components/BusinessesMapPanel'), {
  ssr: false,
  loading: () => (
    <div className="mx-3 mb-5 h-[min(52vh,22rem)] animate-pulse rounded-lg bg-gradient-to-br from-violet-100 to-rose-100" />
  ),
});

const BUSINESSES_CACHE_KEY = 'hanar_businesses_cache_v2';
const BUSINESSES_CACHE_KEY_LEGACY = 'hanar_businesses_cache';
const BUSINESSES_UPDATED_EVENT = 'hanar:businesses-updated';
const BUSINESSES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAP_VIEW_CENTER_KEY = 'hanar_map_view_center';
const MAP_AREA_BOUNDS_CACHE_KEY = 'hanar_map_area_bounds_v2';
const MAP_MY_LOCATION_KEY = 'hanar_map_my_location';
const BUSINESSES_UI_TRANSLATION_CACHE_PREFIX = 'hanar_businesses_ui_text:';
const USER_LOCATION_SCOPE_KEY = 'userLocationScope';
const QUICK_FILTER_LABELS = [
  'Restaurants',
  'Dealerships',
  'Auto Services',
  'Home Services',
  'Transportation',
  'Retail',
  'Health & Beauty',
  'More',
];

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
  phone?: string | null;
}

type BusinessLocationFields = {
  location: string;
  location_country?: string | null;
  location_state?: string | null;
  location_city?: string | null;
};

function businessLatLon(b: Business) {
  const normalizedAddress = normalizeAddressInput(b.address);
  return resolveLatLon({ lat: b.lat, lon: b.lon }, normalizedAddress ?? b.address);
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

const LOCATION_NOT_AVAILABLE = 'Location not available';

function getCityState(address: any): string {
  if (!address) return LOCATION_NOT_AVAILABLE;

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

  return LOCATION_NOT_AVAILABLE;
}

export default function BusinessesPage() {
  const { effectiveLang } = useLanguage();
  const [dynamicUiTranslations, setDynamicUiTranslations] = useState<Record<string, string>>({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const yourLocationLabel = t(effectiveLang, 'Your location');
  const isYourLocationLabel = (value: string) =>
    value.trim().toLowerCase() === 'your location' || value.trim().toLowerCase() === yourLocationLabel.trim().toLowerCase();
  const translateUi = (label: string) => dynamicUiTranslations[label] || t(effectiveLang, label);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [relatedBusinessIds, setRelatedBusinessIds] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [radius, setRadius] = useState(() => readSavedSearchRadiusMiles(40));
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [locationSearchValue, setLocationSearchValue] = useState('');
  const [locationScope, setLocationScope] = useState<MarketplaceLocationScope>({ mode: 'none' });
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(6);
  const [selectedMapBusinessId, setSelectedMapBusinessId] = useState<string | null>(null);
  const [listLayout, setListLayout] = useState<'list' | 'cards'>('list');
  const [mapExpanded, setMapExpanded] = useState(true);
  const [geocodeCache, setGeocodeCache] = useState<GeocodeCache>(() =>
    typeof window !== 'undefined' ? readGeocodeCache() : {}
  );
  const [mapGeocoding, setMapGeocoding] = useState(false);
  const [mapViewCenter, setMapViewCenter] = useState(USA_MAP_CENTER);
  const [locationAreaBounds, setLocationAreaBounds] = useState<MapAreaBounds | null>(null);
  const [locationAreaRings, setLocationAreaRings] = useState<MapAreaRing[] | null>(null);
  const [myMapLocation, setMyMapLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [sharingMapLocation, setSharingMapLocation] = useState(false);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [businessesRefreshing, setBusinessesRefreshing] = useState(false);
  const triedAutoLocationRef = useRef(false);
  const lastGeocodedCityQueryRef = useRef<string | null>(null);
  const geocodeFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const searchCacheRef = useRef<Map<string, Set<string>>>(new Map());
  const hasFetchedRef = useRef(false);

  const fetchBusinesses = useCallback(async () => {
    setBusinessesRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select(
          'id, business_name, category, subcategory, address, description, logo_url, slug, lat, lon, spoken_languages, plan, phone'
        )
        .eq('moderation_status', 'active')
        .eq('is_archived', false)
        .neq('lifecycle_status', 'archived');

      if (error) {
        console.error('Supabase fetch error:', error);
        return;
      }
      setBusinesses(data || []);
      writeBusinessesCache(data || []);
    } finally {
      setBusinessesRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    try {
      sessionStorage.removeItem(BUSINESSES_CACHE_KEY_LEGACY);
    } catch {
      /* ignore */
    }

    const cache = readBusinessesCache();
    if (cache) {
      setBusinesses(cache.businesses);
    }
    void fetchBusinesses();
  }, [fetchBusinesses]);

  useEffect(() => {
    const onBusinessesUpdated = () => {
      void fetchBusinesses();
    };
    window.addEventListener(BUSINESSES_UPDATED_EVENT, onBusinessesUpdated);
    return () => window.removeEventListener(BUSINESSES_UPDATED_EVENT, onBusinessesUpdated);
  }, [fetchBusinesses]);

  useEffect(() => {
    let mounted = true;

    const syncAuthState = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (mounted) setIsLoggedIn(Boolean(user));
    };

    syncAuthState();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session?.user));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
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
        toast.error(err?.message || t(effectiveLang, 'Failed to load favorites'));
      }
    };

    loadFavorites();
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadAvatar = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !mounted) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        if (mounted) {
          setUserAvatarUrl(normalizeAvatarUrl(profile?.avatar_url, ['avatars']));
        }
      } catch {
        /* ignore */
      }
    };
    void loadAvatar();
    return () => {
      mounted = false;
    };
  }, [isLoggedIn]);

  useEffect(() => {
    try {
      const savedCenter = localStorage.getItem(MAP_VIEW_CENTER_KEY);
      if (savedCenter) {
        const parsed = JSON.parse(savedCenter) as { lat?: number; lon?: number };
        if (parsed?.lat != null && parsed?.lon != null) {
          setMapViewCenter({ lat: parsed.lat, lon: parsed.lon });
        }
      }
      const savedMyLoc = readStoredCoords([MAP_MY_LOCATION_KEY]);
      if (savedMyLoc) setMyMapLocation(savedMyLoc);
    } catch {
      /* ignore */
    }
  }, []);

  const handleLocationSelect = (result: AddressResult) => {
    const scope = scopeFromAddressResult(result);
    setLocationScope(scope);
    try {
      localStorage.setItem(USER_LOCATION_SCOPE_KEY, JSON.stringify(scope));
    } catch {}

    const label =
      [result.city, result.state, result.country].filter(Boolean).join(', ') ||
      result.formatted_address ||
      t(effectiveLang, 'Selected location');
    setLocationLabel(label);
    setLocationSearchValue(label);
    try {
      if (label) localStorage.setItem('userLocationLabel', label);
    } catch {}

    const isCityPick = scope.mode === 'city_radius' && Boolean(scope.city.trim());
    const isCountryOrState = scope.mode === 'country' || scope.mode === 'state';

    if (result.lat != null && result.lng != null && !isCityPick && !isCountryOrState) {
      const coords = { lat: result.lat, lon: result.lng };
      setUserCoords(coords);
      try {
        localStorage.setItem('userCoords', JSON.stringify(coords));
      } catch {}
      window.dispatchEvent(
        new CustomEvent('location:updated', {
          detail: {
            ...coords,
            label,
            city: result.city,
            state: result.state,
            country: result.country,
            zip: result.zip,
          },
        })
      );
    } else if (isCityPick || isCountryOrState) {
      setUserCoords(null);
      try {
        localStorage.removeItem('userCoords');
      } catch {}
      window.dispatchEvent(
        new CustomEvent('location:updated', {
          detail: {
            label,
            city: result.city,
            state: result.state,
            country: result.country,
            zip: result.zip,
          },
        })
      );
    } else {
      setUserCoords(null);
      try {
        localStorage.removeItem('userCoords');
      } catch {}
      window.dispatchEvent(
        new CustomEvent('location:updated', {
          detail: {
            label,
            city: result.city,
            state: result.state,
            country: result.country,
            zip: result.zip,
          },
        })
      );
    }

    if (result.lat != null && result.lng != null) {
      const center = { lat: result.lat, lon: result.lng };
      setMapViewCenter(center);
      try {
        localStorage.setItem(MAP_VIEW_CENTER_KEY, JSON.stringify(center));
      } catch {}
    }
    setVisibleCount(6);
    setMapExpanded(true);
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        document
          .getElementById('businesses-map-panel')
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 120);
    });
  };

  const handleUseMyLocation = () => {
    const stored = localStorage.getItem('userCoords');
    if (stored) {
      try {
        const { lat, lon } = JSON.parse(stored);
        setUserCoords({ lat, lon });
        setLocationLabel(t(effectiveLang, 'Your location'));
        const geoScope: MarketplaceLocationScope = { mode: 'city_radius', country: '', state: '', city: '' };
        setLocationScope(geoScope);
        localStorage.setItem(USER_LOCATION_SCOPE_KEY, JSON.stringify(geoScope));
        setVisibleCount(6);
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
          let label = t(effectiveLang, 'Your location');
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
          const geoScope: MarketplaceLocationScope = { mode: 'city_radius', country: '', state: '', city: '' };
          setLocationScope(geoScope);
          try {
            localStorage.setItem('userCoords', JSON.stringify(coords));
            if (label) localStorage.setItem('userLocationLabel', label);
            localStorage.setItem(USER_LOCATION_SCOPE_KEY, JSON.stringify(geoScope));
          } catch {}
          window.dispatchEvent(
            new CustomEvent('location:updated', {
              detail: { ...coords, label, city, state, country, radiusMiles: radius },
            })
          );
          setVisibleCount(6);
        })();
      },
      () => toast.error(t(effectiveLang, 'Could not get your location.'))
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
          setLocationLabel(savedLabel || t(effectiveLang, 'Your location'));
        }
      } catch { /* ignore */ }
    }
    try {
      const rawScope = localStorage.getItem(USER_LOCATION_SCOPE_KEY);
      if (rawScope) {
        const scope = JSON.parse(rawScope) as MarketplaceLocationScope;
        setLocationScope(scope);
        if (!savedLabel) {
          let derived = '';
          if (scope.mode === 'country' && scope.country.trim()) {
            derived = scope.country.trim();
          } else if (scope.mode === 'state' && scope.state.trim()) {
            derived = [scope.state, scope.country].filter(Boolean).join(', ');
          } else if (scope.mode === 'city_radius' && scope.city.trim()) {
            derived = [scope.city, scope.state, scope.country].filter(Boolean).join(', ');
          }
          if (derived) {
            setLocationLabel(derived);
            setLocationSearchValue(derived);
          }
        }
      } else if (saved) {
        setLocationScope({ mode: 'city_radius', country: '', state: '', city: '' });
      }
    } catch {
      /* ignore */
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
            setLocationLabel((prev) => prev ?? t(effectiveLang, 'Your location'));
          }
        }
      }
      if (detail?.radiusMiles != null) {
        setRadius(detail.radiusMiles);
      }
      if (detail && (detail.city != null || detail.state != null || detail.country != null)) {
        const next = scopeFromAddressResult({
          city: detail.city,
          state: detail.state,
          country: detail.country,
        });
        setLocationScope(next);
        try {
          localStorage.setItem(USER_LOCATION_SCOPE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener('location:updated', handleLocationUpdated);
    return () => window.removeEventListener('location:updated', handleLocationUpdated);
  }, []);

  useEffect(() => {
    if (triedAutoLocationRef.current) return;
    triedAutoLocationRef.current = true;

    let hasSavedCoords = false;
    let hasSavedScope = false;
    try {
      hasSavedCoords = Boolean(localStorage.getItem('userCoords'));
      hasSavedScope = Boolean(localStorage.getItem(USER_LOCATION_SCOPE_KEY));
    } catch {
      /* ignore */
    }
    if (hasSavedCoords || hasSavedScope) return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void (async () => {
          const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          let city: string | undefined;
          let state: string | undefined;
          let country: string | undefined;
          let label = t(effectiveLang, 'Your location');
          try {
            const res = await fetch(
              `/api/geocode/reverse?lat=${encodeURIComponent(coords.lat)}&lon=${encodeURIComponent(coords.lon)}`
            );
            const data = await res.json().catch(() => ({}));
            const address = data?.address || {};
            city =
              address.city || address.town || address.village || address.hamlet || '';
            state = address.state || address.county || '';
            country = address.country || '';
            const composed = [city, state, country].filter(Boolean).join(', ');
            label = composed || data?.display_name || label;
          } catch {
            /* keep fallback label */
          }

          setUserCoords(coords);
          setLocationLabel(label);
          setLocationSearchValue(label);
          const geoScope: MarketplaceLocationScope = { mode: 'city_radius', country: '', state: '', city: '' };
          setLocationScope(geoScope);
          try {
            localStorage.setItem('userCoords', JSON.stringify(coords));
            if (label) localStorage.setItem('userLocationLabel', label);
            localStorage.setItem(USER_LOCATION_SCOPE_KEY, JSON.stringify(geoScope));
          } catch {
            /* ignore */
          }
        })();
      },
      () => {
        /* user denied or unavailable */
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300_000 }
    );
  }, [effectiveLang]);

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
        toast.error(t(effectiveLang, 'Login required to favorite businesses.'));
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
      toast.error(err?.message || t(effectiveLang, 'Failed to update favorite'));
    }
  };

  const normalizedQuery = query.toLowerCase();
  const isSpecificBusinessSearch = query.trim().length >= 2;
  const normalizeCategoryToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const businessCategoryLabel = (b: Business) => formatBusinessCategory(b.subcategory || b.category) || '';
  const categoryTokenMatchesKey = (category: string, key: string) => {
    switch (key) {
      case 'restaurants':
        return (
          category === 'food' ||
          category.includes('restaurant') ||
          category.includes('cafe') ||
          category.includes('coffee') ||
          category.includes('bakery') ||
          category.includes('catering') ||
          category.includes('food truck')
        );
      case 'dealerships':
        return category === 'dealership' || category.includes('dealership') || category.includes('dealer');
      case 'auto_services':
        return (
          category.includes('auto') ||
          category.includes('repair') ||
          category.includes('mechanic') ||
          category.includes('body shop')
        );
      case 'home_services':
        return (
          category.includes('home') ||
          category.includes('clean') ||
          category.includes('plumb') ||
          category.includes('hvac') ||
          category.includes('electric') ||
          category.includes('landscap') ||
          category.includes('mover') ||
          category.includes('real estate')
        );
      case 'transportation':
        return (
          category.includes('transport') ||
          category.includes('mover') ||
          category.includes('moving') ||
          category.includes('delivery') ||
          category.includes('trucking') ||
          category.includes('truck')
        );
      case 'retail':
        return category === 'retail' || category.includes('retail') || category.includes('shop') || category.includes('store');
      case 'beauty':
        return (
          category.includes('beauty') ||
          category.includes('salon') ||
          category.includes('hair') ||
          category.includes('barber') ||
          category.includes('nail')
        );
      default: {
        const keyToken = normalizeCategoryToken(key);
        return category === keyToken || category.includes(keyToken);
      }
    }
  };

  const matchesSelectedCategory = (b: Business, key: string | null) => {
    if (!key) return true;
    const parentCategory = normalizeCategoryToken(b.category || '');
    if (parentCategory) {
      if (key === 'restaurants' && parentCategory === 'food') return true;
      if (key === 'dealerships' && parentCategory === 'dealership') return true;
      if (key === 'retail' && parentCategory === 'retail') return true;
    }
    const tokens = [businessCategoryLabel(b), b.subcategory || '', b.category || '']
      .map((v) => normalizeCategoryToken(v))
      .filter(Boolean);
    if (tokens.length === 0) return false;
    return tokens.some((category) => categoryTokenMatchesKey(category, key));
  };
  const speaksUserLang = (b: Business) => {
    const langs = b.spoken_languages;
    if (!langs || !Array.isArray(langs) || langs.length === 0) return false;
    return langs.includes(effectiveLang);
  };
  const isPremium = (b: Business) => (b.plan || '').toLowerCase() === 'premium';
  const cityFromLabelRaw = (locationLabel || '').split(',')[0]?.trim() || '';
  const hasExplicitCityScope =
    locationScope.mode === 'city_radius' && Boolean(locationScope.city.trim());
  const hasCityLabel =
    Boolean(cityFromLabelRaw) && !isYourLocationLabel(locationLabel || '');
  const isCityLocationMode = hasExplicitCityScope || hasCityLabel;
  const isRadiusLocationMode = Boolean(
    userCoords &&
      !isCityLocationMode &&
      (isYourLocationLabel(locationLabel || '') ||
        (locationScope.mode === 'city_radius' && !locationScope.city.trim()))
  );
  const scopedCity = !isCityLocationMode
    ? ''
    : hasExplicitCityScope
      ? locationScope.city.trim()
      : cityFromLabelRaw;
  const cityFromLabel = cityFromLabelRaw.toLowerCase();
  const businessLocationFields = (b: Business): BusinessLocationFields => {
    const base: BusinessLocationFields = {
      location: `${getCityState(b.address)} ${typeof b.address === 'string' ? b.address : ''}`.trim(),
      location_country: null,
      location_state: null,
      location_city: null,
    };
    if (b.address && typeof b.address === 'object') {
      return {
        ...base,
        location_country: typeof b.address.country === 'string' ? b.address.country : null,
        location_state:
          typeof b.address.state === 'string'
            ? b.address.state
            : typeof b.address.state_code === 'string'
              ? b.address.state_code
              : null,
        location_city:
          typeof b.address.city === 'string'
            ? b.address.city
            : typeof b.address.town === 'string'
              ? b.address.town
              : typeof b.address.locality === 'string'
                ? b.address.locality
                : null,
      };
    }
    return base;
  };
  const filteredByCategoryAndQuery = useMemo(
    () =>
      businesses.filter((b) => {
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
      }),
    [businesses, selectedCategoryFilter, normalizedQuery, relatedBusinessIds]
  );

  const filtered = filteredByCategoryAndQuery
    .filter((b) => {
      if (locationScope.mode === 'country') {
        return itemMatchesCountryFilter(businessLocationFields(b), locationScope.country);
      }
      if (locationScope.mode === 'state') {
        return itemMatchesStateFilter(businessLocationFields(b), locationScope.state, locationScope.country);
      }
      if (locationScope.mode === 'city_radius' && locationScope.city.trim()) {
        return itemMatchesCityFilter(
          businessLocationFields(b),
          locationScope.city,
          locationScope.state,
          locationScope.country
        );
      }
      if (scopedCity && !isYourLocationLabel(scopedCity)) {
        const scopeState =
          locationScope.mode === 'city_radius'
            ? locationScope.state
            : (locationLabel || '').split(',')[1]?.trim();
        const scopeCountry = locationScope.mode === 'city_radius' ? locationScope.country : undefined;
        return itemMatchesCityFilter(businessLocationFields(b), scopedCity, scopeState, scopeCountry);
      }
      if (userCoords && isRadiusLocationMode) {
        const ll = businessLatLon(b);
        if (ll) {
          return getDistanceMiles(userCoords.lat, userCoords.lon, ll.lat, ll.lon) <= radius;
        }
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (userCoords && isRadiusLocationMode) {
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

    const areaFilterActive =
      locationScope.mode === 'country' ||
      locationScope.mode === 'state' ||
      Boolean(scopedCity) ||
      Boolean(isRadiusLocationMode && userCoords);
  const showAllInLocation = areaFilterActive && !isSpecificBusinessSearch;
  const nearbyFallbackBusinesses = areaFilterActive && !showAllInLocation && filtered.length === 0
    ? filteredByCategoryAndQuery
        .map((b) => {
          const ll = businessLatLon(b);
          const distance =
            userCoords && ll ? getDistanceMiles(userCoords.lat, userCoords.lon, ll.lat, ll.lon) : null;
          return { business: b, distance };
        })
        .filter(({ business, distance }) => {
          if (locationScope.mode === 'country') {
            return !itemMatchesCountryFilter(businessLocationFields(business), locationScope.country);
          }
          if (locationScope.mode === 'state') {
            return !itemMatchesStateFilter(businessLocationFields(business), locationScope.state, locationScope.country);
          }
          if (userCoords && distance != null && isRadiusLocationMode) return distance > radius;
          if (scopedCity && !isYourLocationLabel(scopedCity)) {
            return !itemMatchesCityFilter(
              businessLocationFields(business),
              scopedCity,
              locationScope.mode === 'city_radius' ? locationScope.state : undefined,
              locationScope.mode === 'city_radius' ? locationScope.country : undefined
            );
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

  const visible = showAllInLocation ? filtered : filtered.slice(0, visibleCount);
  const listBusinesses = filtered.length > 0 ? visible : nearbyFallbackBusinesses;

  const mapCategoryOrSearchActive =
    selectedCategoryFilter != null || normalizedQuery.trim().length > 0;

  const resolveCoordsForBusiness = useCallback(
    (biz: Business) => resolveBusinessCoords(biz, geocodeCache),
    [geocodeCache]
  );

  const businessToMapPanel = useCallback(
    (biz: Business): MapPanelBusiness | null => {
      const coords = resolveCoordsForBusiness(biz);
      if (!coords) return null;
      const distanceMi =
        userCoords && isRadiusLocationMode
          ? getDistanceMiles(userCoords.lat, userCoords.lon, coords.lat, coords.lon)
          : null;
      return {
        id: biz.id,
        business_name: biz.business_name,
        slug: biz.slug,
        logo_url: biz.logo_url || '',
        lat: coords.lat,
        lon: coords.lon,
        phone: biz.phone,
        distanceMi,
      };
    },
    [resolveCoordsForBusiness, userCoords, isRadiusLocationMode]
  );

  /** All geocoded pins — keeps coords when category/search filters change. */
  const allMapPanelBusinesses = useMemo((): MapPanelBusiness[] => {
    return businesses
      .map((biz) => businessToMapPanel(biz))
      .filter(Boolean) as MapPanelBusiness[];
  }, [businesses, businessToMapPanel]);

  const categoryOrSearchMatchIds = useMemo(
    () => new Set(filteredByCategoryAndQuery.map((b) => b.id)),
    [filteredByCategoryAndQuery]
  );

  /** Pins shown on map — filter from cached coords, do not rebuild geocode pool. */
  const mapPanelBusinesses = useMemo((): MapPanelBusiness[] => {
    if (!mapCategoryOrSearchActive) return allMapPanelBusinesses;
    return allMapPanelBusinesses.filter((b) => categoryOrSearchMatchIds.has(b.id));
  }, [allMapPanelBusinesses, mapCategoryOrSearchActive, categoryOrSearchMatchIds]);

  /** Businesses that still need geocoding for the active map filter. */
  const mapCandidateBusinesses = useMemo(() => {
    if (!mapCategoryOrSearchActive) return businesses;
    return filteredByCategoryAndQuery;
  }, [businesses, filteredByCategoryAndQuery, mapCategoryOrSearchActive]);

  const mapPendingGeocodeCount = useMemo(
    () => mapCandidateBusinesses.filter((biz) => !resolveCoordsForBusiness(biz)).length,
    [mapCandidateBusinesses, resolveCoordsForBusiness]
  );

  /** Count for map empty/loading UI — category/search matches, not location-only list length. */
  const mapMatchingCount = mapCategoryOrSearchActive
    ? filteredByCategoryAndQuery.length
    : filtered.length;

  const mapChipBusinesses = useMemo(() => {
    const filteredIds = new Set(filtered.map((b) => b.id));
    return mapPanelBusinesses.filter((b) => filteredIds.has(b.id));
  }, [mapPanelBusinesses, filtered]);

  const selectedMapBusinessDetail = useMemo((): MapPanelBusiness | null => {
    if (!selectedMapBusinessId) return null;
    const id = String(selectedMapBusinessId);
    const fromList = businesses.find((b) => String(b.id) === id);
    if (fromList) {
      return businessToMapPanel(fromList);
    }
    return mapPanelBusinesses.find((b) => String(b.id) === id) ?? null;
  }, [selectedMapBusinessId, businesses, mapPanelBusinesses, businessToMapPanel]);

  const trendingPremiumBusinesses = useMemo(() => businesses.filter(isPremium), [businesses]);

  /** Human-readable label shown in the map location box. */
  const chosenLocationDisplay = useMemo(() => {
    const direct = (locationLabel || locationSearchValue || '').trim();
    if (direct) return direct;

    if (locationScope.mode === 'country' && locationScope.country.trim()) {
      return locationScope.country.trim();
    }
    if (locationScope.mode === 'state' && locationScope.state.trim()) {
      return [locationScope.state, locationScope.country].filter(Boolean).join(', ');
    }
    if (locationScope.mode === 'city_radius' && locationScope.city.trim()) {
      return [locationScope.city, locationScope.state, locationScope.country].filter(Boolean).join(', ');
    }
    if (userCoords) {
      return t(effectiveLang, 'Your location');
    }
    return null;
  }, [locationLabel, locationSearchValue, locationScope, userCoords, effectiveLang]);

  const hasChosenLocation = Boolean(chosenLocationDisplay?.trim());

  /** Geocode target from the location box (label, search text, or country/state scope). */
  const locationAreaQuery = useMemo(() => {
    if (isRadiusLocationMode) return null;
    if (locationScope.mode === 'country' && locationScope.country.trim()) {
      return locationScope.country.trim();
    }
    if (locationScope.mode === 'state' && locationScope.state.trim()) {
      return [locationScope.state, locationScope.country].filter(Boolean).join(', ');
    }
    if (locationScope.mode === 'city_radius' && locationScope.city.trim()) {
      return [locationScope.city, locationScope.state, locationScope.country].filter(Boolean).join(', ');
    }
    const label = (locationLabel || locationSearchValue || '').trim();
    if (!label || isYourLocationLabel(label)) return null;
    return label;
  }, [isRadiusLocationMode, locationScope, locationLabel, locationSearchValue]);

  const isUsaMapView = !isRadiusLocationMode && !locationAreaQuery;

  const mapAreaZoom = useMemo(() => {
    if (locationScope.mode === 'country') return 4;
    if (locationScope.mode === 'state') return 6;
    return 11;
  }, [locationScope.mode]);

  const mapViewport = isRadiusLocationMode ? 'radius' : isUsaMapView ? 'usa' : 'area';

  const locationAreaScopeLevel = useMemo((): MapAreaScopeLevel => {
    if (locationScope.mode === 'country') return 'country';
    if (locationScope.mode === 'state') return 'state';
    return 'city';
  }, [locationScope.mode]);

  const geocodeCacheRef = useRef(geocodeCache);
  geocodeCacheRef.current = geocodeCache;
  const geocodePendingRef = useRef<Record<string, { lat: number; lon: number }>>({});

  const flushGeocodeCache = useCallback(() => {
    const pending = geocodePendingRef.current;
    const keys = Object.keys(pending);
    if (keys.length === 0) return;
    geocodePendingRef.current = {};
    setGeocodeCache((prev) => {
      const next = { ...prev, ...pending };
      writeGeocodeCache(next);
      geocodeCacheRef.current = next;
      return next;
    });
  }, []);

  const queueGeocodeResult = useCallback(
    (bizId: string, ll: { lat: number; lon: number }) => {
      geocodePendingRef.current[bizId] = ll;
      if (geocodeFlushTimerRef.current) clearTimeout(geocodeFlushTimerRef.current);
      geocodeFlushTimerRef.current = setTimeout(() => {
        geocodeFlushTimerRef.current = null;
        flushGeocodeCache();
      }, 120);
    },
    [flushGeocodeCache]
  );

  useEffect(() => {
    if (isRadiusLocationMode && userCoords) {
      setMapViewCenter(userCoords);
      setLocationAreaBounds(null);
      setLocationAreaRings(null);
      lastGeocodedCityQueryRef.current = null;
      return;
    }
    if (!locationAreaQuery) {
      setMapViewCenter(USA_MAP_CENTER);
      setLocationAreaBounds(null);
      setLocationAreaRings(null);
      lastGeocodedCityQueryRef.current = '__usa__';
      return;
    }
    if (lastGeocodedCityQueryRef.current === locationAreaQuery) return;

    let cancelled = false;
    void (async () => {
      try {
        const cachedRaw = localStorage.getItem(MAP_AREA_BOUNDS_CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as {
            query?: string;
            bounds?: MapAreaBounds;
            rings?: MapAreaRing[];
            lat?: number;
            lon?: number;
          };
          if (
            cached.query === locationAreaQuery &&
            cached.lat != null &&
            cached.lon != null &&
            isValidMapAreaBounds(cached.bounds)
          ) {
            if (cancelled) return;
            lastGeocodedCityQueryRef.current = locationAreaQuery;
            setMapViewCenter({ lat: cached.lat, lon: cached.lon });
            setLocationAreaBounds(cached.bounds!);
            setLocationAreaRings(hasValidAreaRings(cached.rings) ? cached.rings : null);
            return;
          }
        }
      } catch {
        /* ignore cache */
      }

      const area = await geocodeLocationAreaQuery(locationAreaQuery, locationAreaScopeLevel);
      if (cancelled || !area) return;
      lastGeocodedCityQueryRef.current = locationAreaQuery;
      setMapViewCenter({ lat: area.lat, lon: area.lon });
      setLocationAreaBounds(area.bounds);
      setLocationAreaRings(hasValidAreaRings(area.rings) ? area.rings : null);
      try {
        localStorage.setItem(MAP_VIEW_CENTER_KEY, JSON.stringify({ lat: area.lat, lon: area.lon }));
        localStorage.setItem(
          MAP_AREA_BOUNDS_CACHE_KEY,
          JSON.stringify({
            query: locationAreaQuery,
            lat: area.lat,
            lon: area.lon,
            bounds: area.bounds,
            rings: area.rings,
          })
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isRadiusLocationMode, userCoords, locationAreaQuery, locationAreaScopeLevel]);

  useEffect(() => {
    let cancelled = false;
    const missing = mapCandidateBusinesses.filter((biz) => !resolveCoordsForBusiness(biz));
    if (missing.length === 0) {
      setMapGeocoding(false);
      return;
    }

    setMapGeocoding(true);
    const geocodeBatch = async (queue: Business[]) => {
      let index = 0;
      const workerCount = 3;
      const worker = async () => {
        while (!cancelled && index < queue.length) {
          const biz = queue[index++];
          const query = addressGeocodeQueryFromTable(biz.address);
          if (!query) continue;
          const ll = await geocodeAddressQuery(query);
          if (cancelled || !ll) continue;
          queueGeocodeResult(biz.id, ll);
        }
      };
      await Promise.all(Array.from({ length: workerCount }, () => worker()));
    };

    void geocodeBatch(missing).finally(() => {
      if (!cancelled) setMapGeocoding(false);
    });

    return () => {
      cancelled = true;
    };
  }, [mapCandidateBusinesses, resolveCoordsForBusiness, queueGeocodeResult]);

  useEffect(() => {
    if (
      selectedMapBusinessId &&
      mapPanelBusinesses.some((b) => String(b.id) === String(selectedMapBusinessId))
    ) {
      return;
    }
    setSelectedMapBusinessId(mapPanelBusinesses[0]?.id ?? null);
  }, [mapPanelBusinesses, selectedMapBusinessId]);

  useEffect(() => {
    if (!selectedMapBusinessId) return;
    const el = document.getElementById(`business-${selectedMapBusinessId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedMapBusinessId]);
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
  const [categoryScrollHints, setCategoryScrollHints] = useState({ left: false, right: false });
  const categoryUserPausedUntilRef = useRef(0);
  const categoryProgrammaticScrollRef = useRef(false);

  const updateCategoryScrollHints = useCallback(() => {
    const el = categoryScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCategoryScrollHints({
      left: scrollLeft > 6,
      right: scrollLeft + clientWidth < scrollWidth - 6,
    });
  }, []);

  const pauseCategoryAutoplay = useCallback((durationMs = 8000) => {
    categoryUserPausedUntilRef.current = Date.now() + durationMs;
  }, []);

  const onCategoryScroll = useCallback(() => {
    updateCategoryScrollHints();
    if (!categoryProgrammaticScrollRef.current) {
      pauseCategoryAutoplay();
    }
  }, [updateCategoryScrollHints, pauseCategoryAutoplay]);

  const scrollCategories = useCallback(
    (direction: 'left' | 'right') => {
      const el = categoryScrollRef.current;
      if (!el) return;
      pauseCategoryAutoplay();
      const step = Math.max(el.clientWidth * 0.72, 160);
      categoryProgrammaticScrollRef.current = true;
      el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' });
      window.setTimeout(() => {
        categoryProgrammaticScrollRef.current = false;
      }, 450);
    },
    [pauseCategoryAutoplay]
  );

  const advanceCategoryCarousel = useCallback(() => {
    const el = categoryScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    if (scrollWidth <= clientWidth + 6) return;

    const step = Math.max(clientWidth * 0.55, 140);
    const atEnd = scrollLeft + clientWidth >= scrollWidth - 6;

    categoryProgrammaticScrollRef.current = true;
    if (atEnd) {
      el.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      el.scrollBy({ left: step, behavior: 'smooth' });
    }
    window.setTimeout(() => {
      categoryProgrammaticScrollRef.current = false;
    }, 450);
  }, []);

  useEffect(() => {
    updateCategoryScrollHints();
    const el = categoryScrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateCategoryScrollHints);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateCategoryScrollHints, businesses.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) return;

    const id = window.setInterval(() => {
      if (Date.now() < categoryUserPausedUntilRef.current) return;
      advanceCategoryCarousel();
    }, 3200);

    return () => window.clearInterval(id);
  }, [advanceCategoryCarousel]);

  const allBusinessCategories = useMemo(
    () =>
      Array.from(
        new Set(
          businesses
            .map((b) => businessCategoryLabel(b))
            .map((v) => v.trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [businesses]
  );
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
  const dynamicUiLabels = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...QUICK_FILTER_LABELS,
            ...allBusinessCategories,
            ...businesses.map((b) => formatBusinessCategory(b.subcategory || b.category)).filter(Boolean),
          ].map((value) => String(value).trim()).filter(Boolean)
        )
      ),
    [allBusinessCategories, businesses]
  );

  useEffect(() => {
    if (effectiveLang === 'en') {
      setDynamicUiTranslations({});
      return;
    }

    const cacheKey = `${BUSINESSES_UI_TRANSLATION_CACHE_PREFIX}${effectiveLang}`;
    let cancelled = false;
    const loadDynamicTranslations = async () => {
      let cachedMap: Record<string, string> = {};
      try {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw) as Record<string, string>;
          if (parsed && typeof parsed === 'object') cachedMap = parsed;
        }
      } catch {
        // Ignore cache read issues.
      }

      if (!cancelled) setDynamicUiTranslations(cachedMap);

      const missing = dynamicUiLabels.filter((label) => !cachedMap[label]);
      if (missing.length === 0) return;

      // Populate missing entries from existing UI translation dictionaries/runtime map
      // and store locally so they are one-time on this device.
      const updates: Record<string, string> = {};
      missing.forEach((label) => {
        updates[label] = t(effectiveLang, label);
      });
      if (cancelled) return;
      const merged = { ...cachedMap, ...updates };
      setDynamicUiTranslations(merged);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(merged));
      } catch {
        // Ignore quota issues.
      }
    };

    void loadDynamicTranslations();
    return () => {
      cancelled = true;
    };
  }, [effectiveLang, dynamicUiLabels]);

  const handlePullRefresh = useCallback(async () => {
    try {
      sessionStorage.removeItem(BUSINESSES_CACHE_KEY);
    } catch {}
    setVisibleCount(6);
    await fetchBusinesses();
  }, [fetchBusinesses]);

  const handleMapRadiusChange = useCallback((miles: number) => {
    setRadius(miles);
    writeSavedSearchRadiusMiles(miles);
  }, []);

  const handleShareMapLocation = useCallback(() => {
    const applyCoords = (
      coords: { lat: number; lon: number },
      opts?: { approximate?: boolean; fromCache?: boolean }
    ) => {
      setMyMapLocation(coords);
      try {
        localStorage.setItem(MAP_MY_LOCATION_KEY, JSON.stringify(coords));
      } catch {
        /* ignore */
      }
      if (opts?.approximate) {
        toast(
          t(effectiveLang, 'Showing approximate location based on your IP address'),
          { icon: 'ℹ️' }
        );
      } else if (opts?.fromCache) {
        toast.success(t(effectiveLang, 'Showing your last known location on the map'));
      } else {
        toast.success(t(effectiveLang, 'Your location is shown on the map'));
      }
    };

    const locationErrorMessage = (code: string) => {
      switch (code) {
        case 'denied':
          return t(
            effectiveLang,
            'Location permission was denied. Allow location for this site in your browser settings, then try again.'
          );
        case 'timeout':
          return t(
            effectiveLang,
            'Finding your location took too long. Check that location services are on and try again.'
          );
        case 'unsupported':
          return t(effectiveLang, 'Your browser does not support location sharing.');
        case 'insecure':
          return t(
            effectiveLang,
            'Location requires HTTPS. Showing approximate location when available.'
          );
        default:
          return t(
            effectiveLang,
            'Could not get your location. Check that location services are enabled and try again.'
          );
      }
    };

    setSharingMapLocation(true);
    const locationPromise = requestLocationWithFallback();
    void locationPromise
      .then((result) => {
        if (result.ok) {
          applyCoords(
            { lat: result.lat, lon: result.lon },
            { approximate: result.approximate }
          );
          return;
        }

        const cached = readStoredCoords([MAP_MY_LOCATION_KEY, 'userCoords']);
        if (cached) {
          applyCoords(cached, { fromCache: true });
          if (result.code === 'denied') {
            toast(
              t(
                effectiveLang,
                'Using your last saved location. Allow location access for live updates.'
              ),
              { icon: 'ℹ️' }
            );
          }
          return;
        }

        toast.error(locationErrorMessage(result.code));
      })
      .finally(() => {
        setSharingMapLocation(false);
      });
  }, [effectiveLang]);

  const getBusinessHref = (biz: Business) => {
    const value = String(biz.slug || biz.id || '').trim();
    return value ? `/business/${encodeURIComponent(value)}` : '/businesses';
  };

  const showBusinessOnMap = useCallback(
    (biz: Business) => {
      const coords = resolveCoordsForBusiness(biz);
      if (!coords) {
        toast.error(t(effectiveLang, 'Location not available'));
        return;
      }
      if (!mapPanelBusinesses.some((b) => b.id === biz.id)) {
        toast.error(
          t(effectiveLang, 'This business is not shown on the map with your current filters')
        );
        return;
      }
      setMapExpanded(true);
      setSelectedMapBusinessId(biz.id);
      window.requestAnimationFrame(() => {
        document
          .getElementById('businesses-map-panel')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    [resolveCoordsForBusiness, mapPanelBusinesses, effectiveLang]
  );

  const renderBusinessRow = (biz: Business) => {
    const displayCategory = formatBusinessCategory(biz.subcategory || biz.category);
    const locationText = getCityState(biz.address);
    const bizCoords = resolveCoordsForBusiness(biz);
    const isMapSelected = selectedMapBusinessId === biz.id;
    const categoryStyle =
      categoryColors[displayCategory] || categoryColors[biz.category] || categoryColors.default;
    const locationLine =
      locationText === LOCATION_NOT_AVAILABLE ? t(effectiveLang, 'Location not available') : locationText;
    const distanceLine =
      userCoords && bizCoords && isRadiusLocationMode
        ? `${getDistanceMiles(userCoords.lat, userCoords.lon, bizCoords.lat, bizCoords.lon).toFixed(1)} ${t(effectiveLang, 'mi away')}`
        : null;

    const rowActions = (
      <div className="flex shrink-0 gap-1.5">
        <Link
          href={getBusinessHref(biz)}
          className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          {t(effectiveLang, 'View')}
        </Link>
        {bizCoords ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              showBusinessOnMap(biz);
            }}
            className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
          >
            {t(effectiveLang, 'On map')}
          </button>
        ) : null}
      </div>
    );

    if (listLayout === 'cards') {
      return (
        <article
          key={biz.id}
          id={`business-${biz.id}`}
          className={`overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md ${
            isMapSelected ? 'border-violet-400 ring-2 ring-violet-200' : 'border-slate-200'
          }`}
          data-no-translate
        >
          <Link href={getBusinessHref(biz)} className="group block">
            <div className="relative h-28 bg-slate-100">
              <img
                src={
                  biz.logo_url ||
                  'https://images.unsplash.com/photo-1557426272-fc91fdb8f385?w=800&auto=format&fit=crop'
                }
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              />
              <button
                type="button"
                onClick={(e) => toggleFavorite(e, biz.id)}
                className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow"
                aria-label={t(effectiveLang, 'Toggle favorite')}
              >
                {favorites.includes(biz.id) ? (
                  <FaHeart className="h-3.5 w-3.5 text-rose-500" />
                ) : (
                  <FaRegHeart className="h-3.5 w-3.5 text-slate-500" />
                )}
              </button>
            </div>
          </Link>
          <div className="space-y-2 p-2">
            <Link href={getBusinessHref(biz)} className="min-w-0 block">
              <h3 className="line-clamp-1 text-sm font-bold text-slate-900">{biz.business_name}</h3>
              {displayCategory ? (
                <span
                  className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${categoryStyle}`}
                >
                  {translateUi(displayCategory)}
                </span>
              ) : null}
            </Link>
            <p className="line-clamp-1 text-[11px] text-slate-500">
              {locationLine}
              {distanceLine ? ` · ${distanceLine}` : ''}
            </p>
            {rowActions}
          </div>
        </article>
      );
    }

    return (
      <div
        key={biz.id}
        id={`business-${biz.id}`}
        className={`flex gap-3 px-3 py-2.5 transition ${
          isMapSelected ? 'bg-violet-50' : 'hover:bg-slate-50'
        }`}
        data-no-translate
      >
        <Link href={getBusinessHref(biz)} className="group flex min-w-0 flex-1 gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            <img
              src={
                biz.logo_url ||
                'https://images.unsplash.com/photo-1557426272-fc91fdb8f385?w=800&auto=format&fit=crop'
              }
              alt="Business logo"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="line-clamp-1 text-sm font-semibold text-slate-900 group-hover:text-violet-700"
              data-no-translate
            >
              {biz.business_name}
            </h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              {displayCategory ? (
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${categoryStyle}`}
                >
                  {translateUi(displayCategory)}
                </span>
              ) : null}
              <span className="text-[11px] text-slate-500">{locationLine}</span>
            </div>
            {distanceLine ? (
              <p className="mt-0.5 text-[11px] font-medium text-violet-600">{distanceLine}</p>
            ) : null}
          </div>
        </Link>
        <div className="flex flex-col items-end justify-between gap-1">
          <button
            type="button"
            onClick={(e) => toggleFavorite(e, biz.id)}
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-rose-500"
            aria-label={t(effectiveLang, 'Toggle favorite')}
          >
            {favorites.includes(biz.id) ? (
              <FaHeart className="h-3.5 w-3.5 text-rose-500" />
            ) : (
              <FaRegHeart className="h-3.5 w-3.5" />
            )}
          </button>
          {rowActions}
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (showAllInLocation) return;
    const observer = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && setVisibleCount((c) => c + 6),
      { threshold: 0.1 }
    );
    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [filtered, showAllInLocation]);

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pb-10 sm:pb-12">
      <div className="mx-auto max-w-[66rem] px-3 pt-0 sm:px-4">
        {/* Search bar */}
        <div className="sticky top-[calc(4rem+env(safe-area-inset-top,0px))] z-[110] -mx-3 mb-0 border-b border-slate-200 bg-white px-3 pb-3 pt-2.5 shadow-sm sm:px-4 sm:pt-3">
          <div className="mx-auto max-w-3xl">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-rose-500"
                aria-hidden
              />
              <input
                type="search"
                placeholder={t(effectiveLang, 'Find a restaurant, salon, gym...')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && query.trim()) setVisibleCount(6);
                }}
                className="w-full rounded-xl border-2 border-rose-200 bg-white py-2.5 pl-10 pr-10 text-sm font-medium text-slate-900 shadow-md ring-1 ring-rose-100 placeholder:font-normal placeholder:text-slate-500 transition focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 dark:border-rose-900/50 dark:bg-gray-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-rose-400"
              />
              {searching ? (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400">
                  {t(effectiveLang, 'Searching…')}
                </span>
              ) : query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setVisibleCount(6);
                  }}
                  className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label={t(effectiveLang, 'Clear search')}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        </div>

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
                <h3 className="text-[15px] font-bold text-[#0f1111]">{t(effectiveLang, 'More categories')}</h3>
                <button
                  type="button"
                  onClick={() => setCategoriesModalOpen(false)}
                  className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label={t(effectiveLang, 'Close categories')}
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
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                      selectedCategoryFilter === null
                        ? 'border border-indigo-200 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/35 dark:border-indigo-700 dark:bg-indigo-950/55 dark:text-indigo-100 dark:ring-indigo-400/45'
                        : 'border border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-gray-800 dark:text-slate-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span aria-hidden>🌐</span>
                    <span>{t(effectiveLang, 'All categories')}</span>
                  </button>
                  {moreCategories.map((category) => {
                    const selected = selectedCategoryFilter === category;
                    return (
                      <button
                        key={`more-cat-${category}`}
                        type="button"
                        onClick={() => {
                          setSelectedCategoryFilter(category);
                          setCategoriesModalOpen(false);
                          setVisibleCount(6);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                          selected
                            ? 'border border-indigo-200 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/35 dark:border-indigo-700 dark:bg-indigo-950/55 dark:text-indigo-100 dark:ring-indigo-400/45'
                            : 'border border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-gray-800 dark:text-slate-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span>{translateUi(category)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Category carousel */}
        <section
          className="relative left-1/2 mb-0 w-screen -translate-x-1/2 border-b border-slate-200/80 bg-white/80 py-2.5 backdrop-blur-sm dark:border-slate-700/80 dark:bg-gray-900/80"
          onMouseEnter={() => pauseCategoryAutoplay(60_000)}
          onMouseLeave={() => {
            categoryUserPausedUntilRef.current = Date.now() + 1200;
          }}
          onTouchStart={() => pauseCategoryAutoplay()}
        >
          <div className="relative">
            {categoryScrollHints.left ? (
              <>
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white via-white/80 to-transparent dark:from-gray-900 dark:via-gray-900/80"
                  aria-hidden
                />
                <button
                  type="button"
                  onClick={() => scrollCategories('left')}
                  className="absolute left-1 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-gray-800 dark:text-slate-200 dark:hover:bg-gray-700"
                  aria-label={t(effectiveLang, 'Scroll categories left')}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
              </>
            ) : null}

            {categoryScrollHints.right ? (
              <>
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white via-white/80 to-transparent dark:from-gray-900 dark:via-gray-900/80"
                  aria-hidden
                />
                <button
                  type="button"
                  onClick={() => scrollCategories('right')}
                  className="absolute right-1 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-gray-800 dark:text-slate-200 dark:hover:bg-gray-700"
                  aria-label={t(effectiveLang, 'Scroll categories right')}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </>
            ) : null}

            <div
              ref={categoryScrollRef}
              onScroll={onCategoryScroll}
              className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-smooth px-3 pb-1 scrollbar-hide [scroll-padding-inline:12px] [-webkit-overflow-scrolling:touch]"
            >
              {quickFilters.map((item) => {
                const selected = item.more
                  ? Boolean(selectedCategoryFilter && moreCategories.includes(selectedCategoryFilter))
                  : selectedCategoryFilter === item.key;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      pauseCategoryAutoplay();
                      if (item.more) {
                        setCategoriesModalOpen(true);
                      } else {
                        setSelectedCategoryFilter(selected ? null : item.key);
                        setQuery('');
                        setCategoriesModalOpen(false);
                      }
                      setVisibleCount(6);
                    }}
                    className={cn(
                      'inline-flex shrink-0 snap-start snap-always items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold shadow-sm transition',
                      selected
                        ? 'border border-indigo-200 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/35 dark:border-indigo-700 dark:bg-indigo-950/55 dark:text-indigo-100 dark:ring-indigo-400/45'
                        : 'border border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-gray-800 dark:text-slate-200 dark:hover:bg-gray-700'
                    )}
                  >
                    <span aria-hidden className="text-[17px] leading-none">
                      {item.icon}
                    </span>
                    <span className="whitespace-nowrap">{translateUi(item.label)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <BusinessesMapPanel
          locationBar={
            <div className="relative z-30 space-y-2 overflow-visible border-b border-slate-100 bg-white px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-wide',
                    hasChosenLocation ? 'text-emerald-700' : 'text-slate-500'
                  )}
                >
                  {hasChosenLocation
                    ? t(effectiveLang, 'Selected location')
                    : t(effectiveLang, 'Search in this area')}
                </p>
                {hasChosenLocation ? (
                  <span className="min-w-0 truncate text-[10px] font-medium text-emerald-800">
                    {chosenLocationDisplay}
                  </span>
                ) : null}
              </div>
              <div className="relative z-30 flex items-center gap-2 overflow-visible">
                <AddressAutocomplete
                  value={locationSearchValue}
                  onSelect={handleLocationSelect}
                  onChange={setLocationSearchValue}
                  placeholder={t(effectiveLang, 'Search country, state, city, ZIP, or address...')}
                  mode="locality"
                  className="min-w-0 flex-1"
                  inputClassName={cn(
                    'w-full rounded-lg border px-2.5 py-1.5 text-xs text-slate-900 transition focus:outline-none focus:ring-2 dark:bg-gray-800 dark:text-gray-100',
                    hasChosenLocation
                      ? 'border-emerald-300 bg-emerald-50/50 focus:border-emerald-400 focus:ring-emerald-500/25'
                      : 'border-slate-200 bg-slate-50 focus:border-rose-400 focus:bg-white focus:ring-rose-500/25 dark:border-gray-600'
                  )}
                />
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  title={t(effectiveLang, 'Use my current location')}
                  aria-label={t(effectiveLang, 'Use my current location')}
                  className="flex h-[34px] shrink-0 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 text-[10px] font-semibold leading-none text-blue-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-100 active:scale-[0.98] dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/50"
                >
                  <Navigation className="h-3.5 w-3.5 shrink-0 fill-blue-600 text-blue-600 dark:fill-blue-400 dark:text-blue-400" aria-hidden />
                  <span className="whitespace-nowrap">{t(effectiveLang, 'My location')}</span>
                </button>
              </div>
            </div>
          }
          businesses={mapPanelBusinesses}
          chipBusinesses={mapChipBusinesses}
          totalRegisteredCount={businesses.length}
          matchingCount={mapMatchingCount}
          pendingGeocodeCount={mapPendingGeocodeCount}
          geocoding={
            mapGeocoding ||
            businessesRefreshing ||
            (mapMatchingCount > 0 && mapPanelBusinesses.length === 0 && mapPendingGeocodeCount > 0)
          }
          userCoords={isRadiusLocationMode ? userCoords : null}
          mapUserCoords={myMapLocation ?? (isRadiusLocationMode ? userCoords : null)}
          userAvatarUrl={userAvatarUrl}
          onShareMapLocation={handleShareMapLocation}
          sharingMapLocation={sharingMapLocation}
          mapViewCenter={mapViewCenter}
          mapViewport={mapViewport}
          mapAreaZoom={mapAreaZoom}
          isRadiusMode={isRadiusLocationMode}
          selectedAreaBounds={mapViewport === 'area' ? locationAreaBounds : null}
          selectedAreaRings={
            mapViewport === 'area' && locationAreaScopeLevel === 'city' ? locationAreaRings : null
          }
          expanded={mapExpanded}
          onExpandedChange={setMapExpanded}
          radiusMiles={radius}
          minRadiusMiles={5}
          maxRadiusMiles={100}
          onRadiusChange={handleMapRadiusChange}
          selectedId={selectedMapBusinessId}
          selectedBusiness={selectedMapBusinessDetail}
          onSelect={setSelectedMapBusinessId}
          getBusinessHref={(biz) => `/business/${encodeURIComponent(biz.slug || biz.id)}`}
          labels={{
            showOnMap: t(effectiveLang, 'Show on map'),
            hideMap: t(effectiveLang, 'Hide map'),
            onMap: t(effectiveLang, 'on map'),
            tapToExplore: t(effectiveLang, 'Tap to explore'),
            noLocations: t(effectiveLang, 'No mapped locations yet'),
            noLocationsButMatches: t(
              effectiveLang,
              'Businesses match your filters but addresses need geocoding'
            ),
            geocodingAddresses: t(effectiveLang, 'Geocoding addresses…'),
            radius: t(effectiveLang, 'Radius'),
            miles: t(effectiveLang, 'miles'),
            openInMaps: t(effectiveLang, 'Directions'),
            viewProfile: t(effectiveLang, 'View profile'),
            call: t(effectiveLang, 'Call'),
            shareMyLocation: t(effectiveLang, 'Show my location'),
            myLocationOnMap: t(effectiveLang, 'My location on map'),
            youLabel: t(effectiveLang, 'You'),
          }}
        />

        {trendingPremiumBusinesses.length > 0 && (
          <section className="relative left-1/2 mb-4 w-screen -translate-x-1/2 px-3">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b border-rose-200/80 bg-gradient-to-r from-white via-rose-50 to-rose-200 px-3 py-2.5">
                <h2 className="inline-flex items-center gap-1.5 rounded-md border border-rose-200/80 bg-white/90 px-2.5 py-1 text-sm font-bold text-rose-950 shadow-sm">
                  <TrendingUp className="h-4 w-4 text-rose-600" strokeWidth={2} aria-hidden />
                  <span>{t(effectiveLang, 'Trending businesses')}</span>
                </h2>
                {!isLoggedIn && (
                  <Link
                    href="/register"
                    className="shrink-0 rounded-md border border-rose-200/80 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-rose-900 transition hover:bg-white"
                  >
                    {t(effectiveLang, 'Register your business for free')}
                  </Link>
                )}
              </div>
              <div className="px-3 py-3">
                <TrendingBusinessesSlideshow
                  businesses={trendingPremiumBusinesses}
                  getBusinessHref={(biz) => getBusinessHref(biz as Business)}
                  formatCategoryLabel={(biz) =>
                    translateUi(formatBusinessCategory(biz.subcategory || biz.category) || 'Business')
                  }
                />
              </div>
            </div>
          </section>
        )}

        {/* Businesses nearby */}
        <section className="rounded-none border-y border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
            <h2 className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-white px-3 py-1 text-base font-semibold tracking-tight text-slate-900 shadow-sm">
              <Sparkles className="h-4 w-4 text-violet-500" strokeWidth={2} aria-hidden />
              <span>{t(effectiveLang, 'Businesses nearby')}</span>
            </h2>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setListLayout('list')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  listLayout === 'list'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                aria-pressed={listLayout === 'list'}
              >
                <List className="h-3.5 w-3.5" aria-hidden />
                {t(effectiveLang, 'List')}
              </button>
              <button
                type="button"
                onClick={() => setListLayout('cards')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  listLayout === 'cards'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                aria-pressed={listLayout === 'cards'}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
                {t(effectiveLang, 'Cards')}
              </button>
            </div>
          </div>
          {areaFilterActive && filtered.length === 0 && !isSpecificBusinessSearch && (
            <div className="mx-3 mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
              {t(effectiveLang, 'No businesses found in your selected area.')}
            </div>
          )}
          {areaFilterActive && filtered.length === 0 && isSpecificBusinessSearch && (
            <div className="mx-3 mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
              {t(effectiveLang, 'No matches found')}
            </div>
          )}
          <div
            className={
              listLayout === 'cards'
                ? 'grid grid-cols-2 gap-2 px-3 pb-3 sm:grid-cols-3'
                : 'divide-y divide-slate-200'
            }
          >
            {listBusinesses.map((biz) => renderBusinessRow(biz))}
          </div>
        </section>

        <div ref={bottomRef} className="mt-8 sm:mt-10 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          {!showAllInLocation && filtered.length > 0 && visible.length < filtered.length ? (
            <span className="inline-flex items-center gap-2">
              <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-rose-500 dark:border-t-rose-400"></div>
              {t(effectiveLang, 'Loading more...')}
            </span>
          ) : (
            filtered.length === 0
              ? (nearbyFallbackBusinesses.length > 0 ? t(effectiveLang, 'Showing nearby results') : t(effectiveLang, 'No matches found'))
              : showAllInLocation
                ? t(effectiveLang, 'Showing all businesses in this area')
                : t(effectiveLang, 'End of list')
          )}
        </div>
      </div>
    </div>
    </PullToRefresh>
  );
}