'use client';

import { Suspense, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { ChevronDown, LayoutGrid, List, Navigation, Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MapPanelBusiness } from '@/components/BusinessesMapPanel';
import TrendingBusinessesSlideshow from '@/components/TrendingBusinessesSlideshow';
import AddressAutocomplete, { type AddressResult } from '@/components/AddressAutocomplete';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';
import PullToRefresh from '@/components/PullToRefresh';
import BusinessProfileLink from '@/components/BusinessProfileLink';
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
import { fetchUserDisplayAvatarUrl } from '@/lib/fetchUserDisplayAvatar';
import {
  itemMatchesCityFilter,
  itemMatchesCountryFilter,
  itemMatchesStateFilter,
  scopeFromAddressResult,
  type MarketplaceLocationScope,
} from '@/lib/marketplaceLocationFilter';
import { isClaimableBusiness } from '@/lib/businessClaim';
import {
  businessesDirectorySearchPath,
  readBusinessesDirectorySearchQuery,
} from '@/lib/businessesDirectorySearch';
import {
  defaultMapCenterFromSnapshot,
  hasSavedBusinessesMapLocation,
  readBusinessesMapLocation,
  writeBusinessesMapLocation,
  type BusinessesMapLocationSnapshot,
} from '@/lib/businessesMapLocationPersist';
import { BUSINESS_CATEGORIES, getBusinessCategoryIcon } from '@/utils/businessCategories';

const BusinessesMapPanel = dynamic(() => import('@/components/BusinessesMapPanel'), {
  ssr: false,
  loading: () => (
    <div className="relative left-1/2 mb-5 w-screen -translate-x-1/2 -mt-[calc(4rem+env(safe-area-inset-top,0px))] h-[100dvh] animate-pulse bg-gradient-to-br from-violet-100 to-rose-100" />
  ),
});

const BUSINESSES_CACHE_KEY = 'hanar_businesses_cache_v4';
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

/** Read last-saved map area for this mount (client only). */
function bootMapLocation(): BusinessesMapLocationSnapshot | null {
  if (typeof window === 'undefined') return null;
  return readBusinessesMapLocation(readSavedSearchRadiusMiles(40));
}

function locationAreaQueryFromScope(scope: MarketplaceLocationScope): string | null {
  if (scope.mode === 'country' && scope.country.trim()) return scope.country.trim();
  if (scope.mode === 'state' && scope.state.trim()) {
    return [scope.state, scope.country].filter(Boolean).join(', ');
  }
  if (scope.mode === 'city_radius' && scope.city.trim()) {
    return [scope.city, scope.state, scope.country].filter(Boolean).join(', ');
  }
  return null;
}

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
  owner_id?: string | null;
  moderation_status?: string | null;
  admin_added_at?: string | null;
  claim_status?: string | null;
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
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-gray-50 pb-10 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
          <div className="mx-auto max-w-[66rem] px-3 pt-6 text-sm text-slate-500">Loading…</div>
        </div>
      }
    >
      <BusinessesPageContent />
    </Suspense>
  );
}

function BusinessesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { effectiveLang } = useLanguage();
  const query = readBusinessesDirectorySearchQuery(searchParams);
  const setQuery = useCallback(
    (value: string) => {
      router.replace(businessesDirectorySearchPath(value, searchParams), { scroll: false });
    },
    [router, searchParams]
  );
  const [dynamicUiTranslations, setDynamicUiTranslations] = useState<Record<string, string>>({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const yourLocationLabel = t(effectiveLang, 'Your location');
  const isYourLocationLabel = (value: string) =>
    value.trim().toLowerCase() === 'your location' || value.trim().toLowerCase() === yourLocationLabel.trim().toLowerCase();
  const translateUi = (label: string) => dynamicUiTranslations[label] || t(effectiveLang, label);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [relatedBusinessIds, setRelatedBusinessIds] = useState<Set<string>>(new Set());
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(
    () => bootMapLocation()?.userCoords ?? null
  );
  const [locationLabel, setLocationLabel] = useState<string | null>(
    () => bootMapLocation()?.label ?? null
  );
  const [radius, setRadius] = useState(
    () => bootMapLocation()?.radiusMiles ?? readSavedSearchRadiusMiles(40)
  );
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [locationSearchValue, setLocationSearchValue] = useState(
    () => bootMapLocation()?.searchText ?? ''
  );
  const [locationScope, setLocationScope] = useState<MarketplaceLocationScope>(
    () => bootMapLocation()?.scope ?? { mode: 'none' }
  );
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(6);
  const [selectedMapBusinessId, setSelectedMapBusinessId] = useState<string | null>(null);
  const [listLayout, setListLayout] = useState<'list' | 'cards'>('list');
  const [mapExpanded, setMapExpanded] = useState(true);
  const [geocodeCache, setGeocodeCache] = useState<GeocodeCache>({});
  const [mapGeocoding, setMapGeocoding] = useState(false);
  const [mapViewCenter, setMapViewCenter] = useState(() =>
    defaultMapCenterFromSnapshot(bootMapLocation())
  );
  const [locationAreaBounds, setLocationAreaBounds] = useState<MapAreaBounds | null>(
    () => bootMapLocation()?.bounds ?? null
  );
  const [locationAreaRings, setLocationAreaRings] = useState<MapAreaRing[] | null>(
    () => bootMapLocation()?.rings ?? null
  );
  const [myMapLocation, setMyMapLocation] = useState<{ lat: number; lon: number } | null>(() =>
    typeof window !== 'undefined' ? readStoredCoords([MAP_MY_LOCATION_KEY, 'userCoords']) : null
  );
  const [sharingMapLocation, setSharingMapLocation] = useState(false);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [businessesRefreshing, setBusinessesRefreshing] = useState(false);
  const triedAutoLocationRef = useRef(false);
  const triedAutoMapLocationRef = useRef(false);
  const lastGeocodedCityQueryRef = useRef<string | null>(
    (() => {
      const saved = bootMapLocation();
      if (!saved) return null;
      if (saved.userCoords && saved.scope.mode === 'city_radius' && !saved.scope.city.trim()) {
        return null;
      }
      const query =
        locationAreaQueryFromScope(saved.scope) ||
        (saved.searchText.trim() ? saved.searchText.trim() : null);
      if (!query) return hasSavedBusinessesMapLocation(saved) ? null : '__usa__';
      return saved.bounds || saved.center ? query : null;
    })()
  );
  const geocodeFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const searchCacheRef = useRef<Map<string, Set<string>>>(new Map());
  const hasFetchedRef = useRef(false);

  const fetchBusinesses = useCallback(async () => {
    setBusinessesRefreshing(true);
    try {
      const selectFields =
        'id, business_name, category, subcategory, address, description, logo_url, slug, lat, lon, spoken_languages, plan, phone, owner_id, moderation_status, admin_added_at, claim_status';

      const baseQuery = () =>
        supabase
          .from('businesses')
          .select(selectFields)
          .eq('is_archived', false)
          .neq('lifecycle_status', 'archived');

      const [activeRes, unclaimedRes, adminAddedRes] = await Promise.all([
        baseQuery().eq('moderation_status', 'active'),
        baseQuery().eq('moderation_status', 'on_hold').is('owner_id', null),
        baseQuery().not('admin_added_at', 'is', null).neq('claim_status', 'claimed'),
      ]);

      if (activeRes.error) console.error('Supabase active businesses fetch error:', activeRes.error);
      if (unclaimedRes.error) console.error('Supabase unclaimed businesses fetch error:', unclaimedRes.error);
      if (adminAddedRes.error) console.error('Supabase admin-added businesses fetch error:', adminAddedRes.error);

      const merged = new Map<string, Business>();
      for (const row of [
        ...(activeRes.data || []),
        ...(unclaimedRes.data || []),
        ...(adminAddedRes.data || []),
      ]) {
        merged.set(row.id, row as Business);
      }
      const list = Array.from(merged.values());
      setBusinesses(list);
      writeBusinessesCache(list);
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
    const storedGeocode = readGeocodeCache();
    if (Object.keys(storedGeocode).length > 0) {
      setGeocodeCache(storedGeocode);
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
      if (!mounted) return;
      if (user) {
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        setUserAvatarUrl(null);
      }
    };

    syncAuthState();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        setUserAvatarUrl(null);
      }
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
        if (!mounted) return;
        if (!user) {
          setUserAvatarUrl(null);
          return;
        }
        const avatarUrl = await fetchUserDisplayAvatarUrl(user.id);
        if (mounted) setUserAvatarUrl(avatarUrl);
      } catch {
        /* ignore */
      }
    };
    void loadAvatar();
    return () => {
      mounted = false;
    };
  }, [isLoggedIn]);

  const persistMyMapLocation = useCallback((coords: { lat: number; lon: number }) => {
    setMyMapLocation(coords);
    try {
      localStorage.setItem(MAP_MY_LOCATION_KEY, JSON.stringify(coords));
    } catch {
      /* ignore */
    }
  }, []);

  const locationPersistRef = useRef({
    searchText: '',
    label: null as string | null,
    scope: { mode: 'none' } as MarketplaceLocationScope,
    center: null as { lat: number; lon: number } | null,
    bounds: null as MapAreaBounds | null,
    rings: null as MapAreaRing[] | null,
    userCoords: null as { lat: number; lon: number } | null,
    radiusMiles: 40,
  });
  locationPersistRef.current = {
    searchText: locationSearchValue,
    label: locationLabel,
    scope: locationScope,
    center: mapViewCenter,
    bounds: locationAreaBounds,
    rings: locationAreaRings,
    userCoords,
    radiusMiles: radius,
  };

  const persistLastMapLocation = useCallback(
    (
      patch?: Partial<{
        searchText: string;
        label: string | null;
        scope: MarketplaceLocationScope;
        center: { lat: number; lon: number } | null;
        bounds: MapAreaBounds | null;
        rings: MapAreaRing[] | null;
        userCoords: { lat: number; lon: number } | null;
        radiusMiles: number;
      }>
    ) => {
      const cur = locationPersistRef.current;
      const next = {
        searchText: patch?.searchText ?? cur.searchText,
        label: patch?.label !== undefined ? patch.label : cur.label,
        scope: patch?.scope ?? cur.scope,
        center: patch?.center !== undefined ? patch.center : cur.center,
        bounds: patch?.bounds !== undefined ? patch.bounds : cur.bounds,
        rings: patch?.rings !== undefined ? patch.rings : cur.rings,
        userCoords: patch?.userCoords !== undefined ? patch.userCoords : cur.userCoords,
        radiusMiles: patch?.radiusMiles ?? cur.radiusMiles,
      };
      locationPersistRef.current = next;
      writeBusinessesMapLocation(next);
    },
    []
  );

  useEffect(() => {
    // Already hydrated from bootMapLocation(); keep legacy center key warm if present.
    try {
      const savedCenter = localStorage.getItem(MAP_VIEW_CENTER_KEY);
      if (savedCenter) {
        const parsed = JSON.parse(savedCenter) as { lat?: number; lon?: number };
        if (parsed?.lat != null && parsed?.lon != null) {
          setMapViewCenter((prev) =>
            prev.lat === parsed.lat && prev.lon === parsed.lon
              ? prev
              : { lat: parsed.lat!, lon: parsed.lon! }
          );
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (triedAutoMapLocationRef.current) return;
    triedAutoMapLocationRef.current = true;

    void requestLocationWithFallback().then((result) => {
      if (!result.ok) return;
      persistMyMapLocation({ lat: result.lat, lon: result.lon });
    });
  }, [persistMyMapLocation]);

  const handleLocationSelect = (result: AddressResult) => {
    const scope = scopeFromAddressResult(result);
    setLocationScope(scope);

    const label =
      [result.city, result.state, result.country].filter(Boolean).join(', ') ||
      result.formatted_address ||
      t(effectiveLang, 'Selected location');
    setLocationLabel(label);
    setLocationSearchValue(label);

    const isCityPick = scope.mode === 'city_radius' && Boolean(scope.city.trim());
    const isCountryOrState = scope.mode === 'country' || scope.mode === 'state';

    let nextUserCoords: { lat: number; lon: number } | null = null;
    if (result.lat != null && result.lng != null && !isCityPick && !isCountryOrState) {
      nextUserCoords = { lat: result.lat, lon: result.lng };
      setUserCoords(nextUserCoords);
      window.dispatchEvent(
        new CustomEvent('location:updated', {
          detail: {
            ...nextUserCoords,
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
      } catch {
        /* ignore */
      }
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

    const center =
      result.lat != null && result.lng != null
        ? { lat: result.lat, lon: result.lng }
        : null;
    if (center) setMapViewCenter(center);

    setLocationAreaBounds(null);
    setLocationAreaRings(null);
    lastGeocodedCityQueryRef.current = null;

    persistLastMapLocation({
      searchText: label,
      label,
      scope,
      center,
      bounds: null,
      rings: null,
      userCoords: nextUserCoords,
    });

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
    const applyMyLocation = (
      coords: { lat: number; lon: number },
      label: string
    ) => {
      const geoScope: MarketplaceLocationScope = {
        mode: 'city_radius',
        country: '',
        state: '',
        city: '',
      };
      setUserCoords(coords);
      persistMyMapLocation(coords);
      setLocationLabel(label);
      setLocationSearchValue(label);
      setLocationScope(geoScope);
      setMapViewCenter(coords);
      setLocationAreaBounds(null);
      setLocationAreaRings(null);
      lastGeocodedCityQueryRef.current = null;
      persistLastMapLocation({
        searchText: label,
        label,
        scope: geoScope,
        center: coords,
        bounds: null,
        rings: null,
        userCoords: coords,
      });
      setVisibleCount(6);
    };

    const stored = localStorage.getItem('userCoords');
    if (stored) {
      try {
        const { lat, lon } = JSON.parse(stored);
        applyMyLocation({ lat, lon }, t(effectiveLang, 'Your location'));
        return;
      } catch {
        /* ignore */
      }
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

          applyMyLocation(coords, label);
          window.dispatchEvent(
            new CustomEvent('location:updated', {
              detail: { ...coords, label, city, state, country, radiusMiles: radius },
            })
          );
        })();
      },
      () => toast.error(t(effectiveLang, 'Could not get your location.'))
    );
  };

  useEffect(() => {
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
      if (!detail) return;

      const nextLabel =
        detail.label?.trim() ||
        [detail.city, detail.state, detail.country].filter(Boolean).join(', ') ||
        null;
      const nextCoords =
        detail.lat != null && detail.lon != null
          ? { lat: detail.lat, lon: detail.lon }
          : null;
      const nextScope =
        detail.city != null || detail.state != null || detail.country != null
          ? scopeFromAddressResult({
              city: detail.city,
              state: detail.state,
              country: detail.country,
            })
          : undefined;

      if (nextCoords) {
        setUserCoords(nextCoords);
        setMyMapLocation((prev) => prev ?? nextCoords);
        setMapViewCenter(nextCoords);
      }
      if (nextLabel) {
        setLocationLabel(nextLabel);
        setLocationSearchValue(nextLabel);
      } else if (nextCoords) {
        setLocationLabel((prev) => prev ?? t(effectiveLang, 'Your location'));
      }
      if (detail.radiusMiles != null) setRadius(detail.radiusMiles);
      if (nextScope) setLocationScope(nextScope);

      // Sync ref before write so we don't persist stale coords from this page's prior selection.
      const cur = locationPersistRef.current;
      if (nextLabel) {
        cur.searchText = nextLabel;
        cur.label = nextLabel;
      }
      if (nextCoords) {
        cur.userCoords = nextCoords;
        cur.center = nextCoords;
        cur.bounds = null;
        cur.rings = null;
      }
      if (nextScope) cur.scope = nextScope;
      if (detail.radiusMiles != null) cur.radiusMiles = detail.radiusMiles;
      writeBusinessesMapLocation({ ...cur });
    };
    window.addEventListener('location:updated', handleLocationUpdated);
    return () => window.removeEventListener('location:updated', handleLocationUpdated);
  }, [effectiveLang]);

  useEffect(() => {
    if (triedAutoLocationRef.current) return;
    triedAutoLocationRef.current = true;

    if (hasSavedBusinessesMapLocation(bootMapLocation())) return;
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

          const geoScope: MarketplaceLocationScope = {
            mode: 'city_radius',
            country: '',
            state: '',
            city: '',
          };
          setUserCoords(coords);
          persistMyMapLocation(coords);
          setLocationLabel(label);
          setLocationSearchValue(label);
          setLocationScope(geoScope);
          setMapViewCenter(coords);
          persistLastMapLocation({
            searchText: label,
            label,
            scope: geoScope,
            center: coords,
            bounds: null,
            rings: null,
            userCoords: coords,
          });
        })();
      },
      () => {
        /* user denied or unavailable */
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300_000 }
    );
  }, [effectiveLang, persistMyMapLocation, persistLastMapLocation]);

  useEffect(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      setRelatedBusinessIds(new Set());
      setVisibleCount(6);
      return;
    }

    if (term.length < 2) {
      setRelatedBusinessIds(new Set());
      setVisibleCount(6);
      return;
    }

    const cached = searchCacheRef.current.get(term);
    if (cached) {
      setRelatedBusinessIds(new Set(cached));
      setVisibleCount(6);
      return;
    }

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
          category.includes('body shop') ||
          category.includes('car wash') ||
          category.includes('tire') ||
          category.includes('towing') ||
          category.includes('detailing') ||
          category.includes('oil change') ||
          category.includes('lube')
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
          category.includes('real estate') ||
          category.includes('roof') ||
          category.includes('paint') ||
          category.includes('contractor') ||
          category.includes('pest') ||
          category.includes('handyman') ||
          category.includes('floor') ||
          category.includes('carpet') ||
          category.includes('appliance') ||
          category.includes('pool') ||
          category.includes('garage door') ||
          category.includes('security') ||
          category.includes('alarm') ||
          category.includes('solar') ||
          category.includes('window') ||
          category.includes('glass') ||
          category.includes('tree') ||
          category.includes('junk') ||
          category.includes('locksmith') ||
          category.includes('concrete') ||
          category.includes('masonry') ||
          category.includes('welding') ||
          category.includes('snow')
        );
      case 'transportation':
        return (
          category.includes('transport') ||
          category.includes('mover') ||
          category.includes('moving') ||
          category.includes('delivery') ||
          category.includes('courier') ||
          category.includes('trucking') ||
          category.includes('truck') ||
          category.includes('taxi') ||
          category.includes('rideshare') ||
          category.includes('limousine') ||
          category.includes('chauffeur') ||
          category.includes('logistics') ||
          category.includes('freight')
        );
      case 'retail':
        return category === 'retail' || category.includes('retail') || category.includes('shop') || category.includes('store');
      case 'beauty':
        return (
          category.includes('beauty') ||
          category.includes('salon') ||
          category.includes('hair') ||
          category.includes('barber') ||
          category.includes('nail') ||
          category.includes('makeup') ||
          category.includes('spa') ||
          category.includes('wellness') ||
          category.includes('health') ||
          category.includes('dentist') ||
          category.includes('doctor') ||
          category.includes('clinic') ||
          category.includes('pharmacy') ||
          category.includes('therapy') ||
          category.includes('gym') ||
          category.includes('fitness') ||
          category.includes('veterinar') ||
          category.includes('optometrist') ||
          category.includes('chiropractic') ||
          category.includes('counseling')
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
      if (key === 'beauty' && parentCategory === 'health') return true;
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
      const fromYou = myMapLocation ?? userCoords;
      const distanceMi = fromYou
        ? getDistanceMiles(fromYou.lat, fromYou.lon, coords.lat, coords.lon)
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
        spoken_languages: biz.spoken_languages ?? null,
        isPremium: isPremium(biz),
      };
    },
    [resolveCoordsForBusiness, userCoords, myMapLocation]
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
      // Only fall back to continental USA when there is no saved map location.
      if (!hasSavedBusinessesMapLocation(bootMapLocation())) {
        setMapViewCenter(USA_MAP_CENTER);
        setLocationAreaBounds(null);
        setLocationAreaRings(null);
        lastGeocodedCityQueryRef.current = '__usa__';
      }
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
            const center = { lat: cached.lat, lon: cached.lon };
            const rings = hasValidAreaRings(cached.rings) ? cached.rings : null;
            setMapViewCenter(center);
            setLocationAreaBounds(cached.bounds!);
            setLocationAreaRings(rings);
            persistLastMapLocation({
              searchText: locationAreaQuery,
              label: locationAreaQuery,
              center,
              bounds: cached.bounds!,
              rings,
              userCoords: null,
            });
            return;
          }
        }
      } catch {
        /* ignore cache */
      }

      const area = await geocodeLocationAreaQuery(locationAreaQuery, locationAreaScopeLevel);
      if (cancelled || !area) return;
      lastGeocodedCityQueryRef.current = locationAreaQuery;
      const center = { lat: area.lat, lon: area.lon };
      const rings = hasValidAreaRings(area.rings) ? area.rings : null;
      setMapViewCenter(center);
      setLocationAreaBounds(area.bounds);
      setLocationAreaRings(rings);
      persistLastMapLocation({
        searchText: locationAreaQuery,
        label: locationAreaQuery,
        center,
        bounds: area.bounds,
        rings,
        userCoords: null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isRadiusLocationMode,
    userCoords,
    locationAreaQuery,
    locationAreaScopeLevel,
    persistLastMapLocation,
  ]);

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

  const quickFilters: Array<{ label: string; icon: string; key: string }> = [
    { label: 'Restaurants', icon: getBusinessCategoryIcon('restaurants'), key: 'restaurants' },
    { label: 'Dealerships', icon: getBusinessCategoryIcon('dealerships'), key: 'dealerships' },
    { label: 'Auto Services', icon: getBusinessCategoryIcon('auto_services'), key: 'auto_services' },
    { label: 'Home Services', icon: getBusinessCategoryIcon('home_services'), key: 'home_services' },
    { label: 'Transportation', icon: getBusinessCategoryIcon('transportation'), key: 'transportation' },
    { label: 'Retail', icon: getBusinessCategoryIcon('retail'), key: 'retail' },
    { label: 'Health & Beauty', icon: getBusinessCategoryIcon('beauty'), key: 'beauty' },
  ];

  const selectCategoryFilter = useCallback((key: string | null) => {
    setSelectedCategoryFilter(key);
    setQuery('');
    setCategoryDropdownOpen(false);
    setVisibleCount(6);
  }, []);

  useEffect(() => {
    if (!categoryDropdownOpen) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (categoryDropdownRef.current && target && !categoryDropdownRef.current.contains(target)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [categoryDropdownOpen]);

  const allBusinessCategories = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...BUSINESS_CATEGORIES.map((c) => c.label),
            ...BUSINESS_CATEGORIES.flatMap((c) => c.subcategories.map((s) => s.label)),
            ...businesses
              .map((b) => businessCategoryLabel(b))
              .map((v) => v.trim())
              .filter(Boolean),
          ]
        )
      ).sort((a, b) => a.localeCompare(b)),
    [businesses]
  );
  const quickFilterReserved = new Set(
    quickFilters.map((f) => normalizeCategoryToken(f.label))
  );
  const moreCategories = allBusinessCategories.filter((name) => {
    const token = normalizeCategoryToken(name);
    if (!token) return false;
    if (quickFilterReserved.has(token)) return false;
    if (token.includes('restaurant') && token === 'restaurants') return false;
    if (token === 'dealerships') return false;
    return true;
  });
  const selectedCategoryDisplay = useMemo(() => {
    if (!selectedCategoryFilter) {
      return { label: t(effectiveLang, 'All categories'), icon: '🌐' };
    }
    const quick = quickFilters.find((item) => item.key === selectedCategoryFilter);
    if (quick) {
      return { label: translateUi(quick.label), icon: quick.icon };
    }
    return {
      label: translateUi(selectedCategoryFilter),
      icon: getBusinessCategoryIcon(selectedCategoryFilter),
    };
  }, [effectiveLang, quickFilters, selectedCategoryFilter, dynamicUiTranslations]);
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
    persistLastMapLocation({ radiusMiles: miles });
  }, [persistLastMapLocation]);

  const handleShareMapLocation = useCallback(() => {
    const applyCoords = (
      coords: { lat: number; lon: number },
      opts?: { approximate?: boolean; fromCache?: boolean }
    ) => {
      persistMyMapLocation(coords);
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
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      void fetchUserDisplayAvatarUrl(user.id).then((avatarUrl) => {
        if (avatarUrl) setUserAvatarUrl(avatarUrl);
      });
    });
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
  }, [effectiveLang, persistMyMapLocation]);

  const getBusinessHref = (biz: Business, opts?: { claim?: boolean }) => {
    const value = String(biz.slug || biz.id || '').trim();
    if (!value) return '/businesses';
    const base = `/business/${encodeURIComponent(value)}`;
    return opts?.claim && isClaimableBusiness(biz) ? `${base}?claim=1` : base;
  };

  useEffect(() => {
    const paths = listBusinesses.slice(0, 16).map((biz) => getBusinessHref(biz));
    for (const path of paths) {
      router.prefetch(path);
    }
  }, [listBusinesses, router]);

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
    const unclaimed = isClaimableBusiness(biz);
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
      <div className="flex shrink-0 flex-wrap gap-1.5">
        {unclaimed ? (
          <BusinessProfileLink
            href={getBusinessHref(biz, { claim: true })}
            className="relative z-[2] inline-flex min-h-8 items-center rounded-full border border-amber-300/80 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 transition active:bg-amber-100"
          >
            {t(effectiveLang, 'Claim')}
          </BusinessProfileLink>
        ) : null}
        <BusinessProfileLink
          href={getBusinessHref(biz)}
          className="relative z-[2] inline-flex min-h-8 items-center rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-white transition active:bg-slate-700"
        >
          {t(effectiveLang, 'View')}
        </BusinessProfileLink>
        {bizCoords ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              showBusinessOnMap(biz);
            }}
            className="relative z-[2] min-h-8 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition active:bg-slate-100"
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
          className={cn(
            'relative overflow-hidden rounded-2xl border bg-slate-100 shadow-[0_6px_20px_rgba(0,0,0,0.18)] ring-1 transition',
            isMapSelected
              ? 'border-white/70 ring-white/50'
              : 'border-slate-200/80 ring-white/30'
          )}
          data-no-translate
        >
          <BusinessProfileLink
            stretch
            href={getBusinessHref(biz)}
            aria-label={biz.business_name}
            className="rounded-2xl"
          >
            <span className="sr-only">{t(effectiveLang, 'View profile')}</span>
          </BusinessProfileLink>
          <div className="relative h-28 bg-slate-200">
            <img
              src={
                biz.logo_url ||
                'https://images.unsplash.com/photo-1557426272-fc91fdb8f385?w=800&auto=format&fit=crop'
              }
              alt=""
              loading="lazy"
              decoding="async"
              className="pointer-events-none h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={(e) => toggleFavorite(e, biz.id)}
              className="absolute right-2 top-2 z-[2] rounded-full bg-white/90 p-2 shadow touch-manipulation [-webkit-tap-highlight-color:transparent]"
              aria-label={t(effectiveLang, 'Toggle favorite')}
            >
              {favorites.includes(biz.id) ? (
                <FaHeart className="h-3.5 w-3.5 text-rose-500" />
              ) : (
                <FaRegHeart className="h-3.5 w-3.5 text-slate-500" />
              )}
            </button>
            {unclaimed ? (
              <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-amber-500/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                {t(effectiveLang, 'Unclaimed')}
              </span>
            ) : null}
          </div>
          <div className="relative z-0 space-y-2 p-2.5">
            <div className="pointer-events-none min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="line-clamp-1 text-sm font-bold text-slate-900">{biz.business_name}</h3>
              </div>
              {displayCategory ? (
                <span
                  className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${categoryStyle}`}
                >
                  {translateUi(displayCategory)}
                </span>
              ) : null}
            </div>
            <p className="pointer-events-none line-clamp-1 text-[11px] text-slate-500">
              {locationLine}
              {distanceLine ? ` · ${distanceLine}` : ''}
            </p>
            <div className="relative z-[2]">{rowActions}</div>
          </div>
        </article>
      );
    }

    return (
      <div
        key={biz.id}
        id={`business-${biz.id}`}
        className={cn(
          'relative mx-3 mb-2 flex gap-3 rounded-2xl border border-slate-200/80 bg-slate-100 px-3 py-2.5 shadow-sm ring-1 ring-white/30 transition',
          isMapSelected ? 'border-white/70 ring-2 ring-white/40' : 'active:bg-slate-50'
        )}
        data-no-translate
      >
        <BusinessProfileLink
          stretch
          href={getBusinessHref(biz)}
          aria-label={biz.business_name}
        >
          <span className="sr-only">{t(effectiveLang, 'View profile')}</span>
        </BusinessProfileLink>
        <div className="pointer-events-none flex min-w-0 flex-1 gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-white bg-slate-200 shadow-md ring-1 ring-slate-300/70">
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
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="line-clamp-1 text-sm font-semibold text-slate-900" data-no-translate>
                {biz.business_name}
              </h3>
              {unclaimed ? (
                <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                  {t(effectiveLang, 'Unclaimed')}
                </span>
              ) : null}
            </div>
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
              <p className="mt-0.5 text-[11px] font-medium text-slate-600">{distanceLine}</p>
            ) : null}
          </div>
        </div>
        <div className="relative z-[2] flex flex-col items-end justify-between gap-1">
          <button
            type="button"
            onClick={(e) => toggleFavorite(e, biz.id)}
            className="min-h-9 min-w-9 rounded-full p-2 text-slate-400 transition active:bg-white active:text-rose-500 touch-manipulation [-webkit-tap-highlight-color:transparent]"
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
    <div className="min-h-screen bg-gradient-to-b from-white via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pb-10 sm:pb-12">
        <BusinessesMapPanel
          mapOverlay={
            <div
              data-address-search-bar
              className="flex items-stretch overflow-visible rounded-2xl border border-white/90 bg-white/95 shadow-[0_8px_28px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/70 backdrop-blur-md dark:border-slate-600/80 dark:bg-gray-900/95 dark:ring-slate-700/80"
            >              <div ref={categoryDropdownRef} className="relative min-w-0 shrink-0 border-r border-slate-200/80 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setCategoryDropdownOpen((open) => !open)}
                  aria-expanded={categoryDropdownOpen}
                  aria-haspopup="listbox"
                  className="flex h-11 max-w-[9.5rem] items-center gap-1.5 px-2.5 text-left sm:max-w-[11rem]"
                >
                  <span aria-hidden className="text-[13px] leading-none">
                    {selectedCategoryDisplay.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                    {selectedCategoryDisplay.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200',
                      categoryDropdownOpen && 'rotate-180'
                    )}
                    aria-hidden
                  />
                </button>

                {categoryDropdownOpen ? (
                  <div
                    role="listbox"
                    aria-label={t(effectiveLang, 'Categories')}
                    className="absolute left-0 top-full z-40 mt-1.5 w-[min(22rem,calc(100vw-2rem))] max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-xl dark:border-slate-600 dark:bg-gray-900"
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedCategoryFilter === null}
                      onClick={() => selectCategoryFilter(null)}
                      className={cn(
                        'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-base font-semibold transition hover:bg-slate-50 dark:hover:bg-gray-800',
                        selectedCategoryFilter === null
                          ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-950/55 dark:text-indigo-100'
                          : 'text-slate-800 dark:text-slate-100'
                      )}
                    >
                      <span aria-hidden className="text-xl leading-none">
                        🌐
                      </span>
                      <span>{t(effectiveLang, 'All categories')}</span>
                    </button>

                    <p className="px-3.5 pb-1 pt-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {t(effectiveLang, 'Popular')}
                    </p>
                    {quickFilters.map((item) => {
                      const selected = selectedCategoryFilter === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => selectCategoryFilter(selected ? null : item.key)}
                          className={cn(
                            'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-base font-semibold transition hover:bg-slate-50 dark:hover:bg-gray-800',
                            selected
                              ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-950/55 dark:text-indigo-100'
                              : 'text-slate-800 dark:text-slate-100'
                          )}
                        >
                          <span aria-hidden className="text-xl leading-none">
                            {item.icon}
                          </span>
                          <span className="truncate">{translateUi(item.label)}</span>
                        </button>
                      );
                    })}

                    {moreCategories.length > 0 ? (
                      <>
                        <div className="my-1.5 border-t border-slate-100 dark:border-slate-700" />
                        <p className="px-3.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {t(effectiveLang, 'All categories')}
                        </p>
                        {moreCategories.map((category) => {
                          const selected = selectedCategoryFilter === category;
                          return (
                            <button
                              key={`more-cat-${category}`}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              onClick={() => selectCategoryFilter(selected ? null : category)}
                              className={cn(
                                'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-base font-semibold transition hover:bg-slate-50 dark:hover:bg-gray-800',
                                selected
                                  ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-950/55 dark:text-indigo-100'
                                  : 'text-slate-800 dark:text-slate-100'
                              )}
                            >
                              <span aria-hidden className="text-xl leading-none">
                                {getBusinessCategoryIcon(category)}
                              </span>
                              <span className="truncate">{translateUi(category)}</span>
                            </button>
                          );
                        })}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="relative z-30 flex min-w-0 flex-1 items-center gap-1.5 overflow-visible px-2">
                <AddressAutocomplete
                  value={locationSearchValue}
                  onSelect={handleLocationSelect}
                  onChange={setLocationSearchValue}
                  placeholder={
                    hasChosenLocation
                      ? chosenLocationDisplay || t(effectiveLang, 'Search location...')
                      : t(effectiveLang, 'Search location...')
                  }
                  mode="locality"
                  dropdownPlacement="under-search"
                  className="min-w-0 flex-1"
                  inputClassName="w-full border-0 bg-transparent px-0 py-2 text-[11px] font-semibold text-slate-800 placeholder:font-medium placeholder:text-slate-400 focus:outline-none focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                <span className="h-5 w-px shrink-0 bg-slate-200 dark:bg-slate-600" aria-hidden />
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  title={t(effectiveLang, 'Use my current location')}
                  aria-label={t(effectiveLang, 'Use my current location')}
                  className="flex h-8 shrink-0 items-center gap-1 rounded-full px-1.5 text-[10px] font-semibold text-blue-700 transition hover:bg-blue-50 active:scale-[0.98] dark:text-blue-300 dark:hover:bg-blue-950/40"
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
          isLoggedIn={isLoggedIn}
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
            away: t(effectiveLang, 'away'),
            openInMaps: t(effectiveLang, 'Directions'),
            viewProfile: t(effectiveLang, 'View profile'),
            call: t(effectiveLang, 'Call'),
            shareMyLocation: t(effectiveLang, 'Show me on the map'),
            myLocationOnMap: t(effectiveLang, 'My location on map'),
            youLabel: t(effectiveLang, 'You'),
          }}
        />

      <div className="mx-auto max-w-[66rem] px-3 sm:px-4">
        {trendingPremiumBusinesses.length > 0 && (
          <section className="relative left-1/2 mb-5 w-screen -translate-x-1/2 px-3">
            <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900 shadow-[0_8px_28px_rgba(15,23,42,0.2)] ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-2 px-3.5 pb-1 pt-3">
                <h2 className="inline-flex items-center gap-2 text-sm font-bold tracking-tight text-white">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white shadow-sm ring-1 ring-white/20">
                    <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  </span>
                  <span>{t(effectiveLang, 'Trending businesses')}</span>
                </h2>
                {!isLoggedIn && (
                  <Link
                    href="/register"
                    className="shrink-0 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/90 shadow-sm transition hover:bg-white/20"
                  >
                    {t(effectiveLang, 'Register your business for free')}
                  </Link>
                )}
              </div>
              <div className="px-3 pb-3 pt-2">
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
        <section
          className="relative left-1/2 mb-5 w-screen -translate-x-1/2 px-3"
          data-no-pull-refresh="true"
        >
          <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900 shadow-[0_8px_28px_rgba(15,23,42,0.2)] ring-1 ring-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 pb-2 pt-3">
              <h2 className="inline-flex items-center gap-2 text-sm font-bold tracking-tight text-white">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white shadow-sm ring-1 ring-white/20">
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                </span>
                <span>{t(effectiveLang, 'Businesses nearby')}</span>
              </h2>
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 p-0.5">
                <button
                  type="button"
                  onClick={() => setListLayout('list')}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
                    listLayout === 'list'
                      ? 'bg-slate-100 text-slate-900 shadow-sm'
                      : 'text-white/70 hover:text-white'
                  )}
                  aria-pressed={listLayout === 'list'}
                >
                  <List className="h-3.5 w-3.5" aria-hidden />
                  {t(effectiveLang, 'List')}
                </button>
                <button
                  type="button"
                  onClick={() => setListLayout('cards')}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
                    listLayout === 'cards'
                      ? 'bg-slate-100 text-slate-900 shadow-sm'
                      : 'text-white/70 hover:text-white'
                  )}
                  aria-pressed={listLayout === 'cards'}
                >
                  <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
                  {t(effectiveLang, 'Cards')}
                </button>
              </div>
            </div>
            {areaFilterActive && filtered.length === 0 && !isSpecificBusinessSearch && (
              <div className="mx-3 mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-300">
                {t(effectiveLang, 'No businesses found in your selected area.')}
              </div>
            )}
            {areaFilterActive && filtered.length === 0 && isSpecificBusinessSearch && (
              <div className="mx-3 mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-300">
                {t(effectiveLang, 'No matches found')}
              </div>
            )}
            <div
              className={
                listLayout === 'cards'
                  ? 'grid grid-cols-2 gap-2.5 px-3 pb-3 sm:grid-cols-3'
                  : 'space-y-0 pb-3'
              }
            >
              {listBusinesses.map((biz) => renderBusinessRow(biz))}
            </div>
          </div>
        </section>

        <div ref={bottomRef} className="mt-6 text-center text-xs text-slate-500 sm:mt-8 sm:text-sm">
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