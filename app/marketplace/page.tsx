'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Store } from 'lucide-react';

import { FaHeart, FaRegHeart, FaMapMarkerAlt } from 'react-icons/fa';
import { supabase } from '@/lib/supabaseClient';
import PullToRefresh from '@/components/PullToRefresh';
import AddressAutocomplete, { type AddressResult } from '@/components/AddressAutocomplete';
import {
  recordMarketplaceItemView,
} from '@/lib/marketplacePersonalize';
import {
  getDistanceMiles,
  readSavedSearchRadiusMiles,
  resolveLatLon,
  writeSavedSearchRadiusMiles,
} from '@/lib/geoDistance';
import {
  itemMatchesCountryFilter,
  itemMatchesStateFilter,
  scopeFromAddressResult,
  type MarketplaceLocationScope,
} from '@/lib/marketplaceLocationFilter';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';
import { CATEGORY_SEPARATOR, parseMarketplaceCategoryForForm } from '@/lib/marketplaceCategories';
import { getMarketplaceCategoryIcon } from '@/lib/marketplaceCategoryIcons';

type MarketplaceItem = {
  id: string;
  title: string;
  price: string | number;
  location: string;
  category: string;
  condition: string;
  description?: string | null;
  imageUrls: string[] | null;
  lat?: number | null;
  lon?: number | null;
  created_at?: string | null;
  slug: string;
  source: 'retail' | 'dealership' | 'real_estate' | 'individual';
  business_id?: string | null;
  user_id?: string | null;
  business_verified?: boolean;
  business_plan?: string | null;
  location_country?: string | null;
  location_state?: string | null;
  location_city?: string | null;
  /** Optional external buy link (affiliate / online stores). */
  external_buy_url?: string | null;
};

type FavoriteItem = {
  key: string;
  id: string;
  source: 'retail' | 'dealership' | 'real_estate' | 'individual';
  slug: string;
  title: string;
  price: string | number;
  image: string;
  location?: string;
};

const RECENT_SEARCHES_KEY = 'marketplaceRecentSearches';
const RECENT_SEARCHES_MAX = 10;

const getStorageUrl = (bucket: string, path?: string | null) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
};

const normalizeImages = (value: unknown, bucket: string): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => getStorageUrl(bucket, String(item))).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => getStorageUrl(bucket, String(item))).filter(Boolean);
      }
      return [getStorageUrl(bucket, value)].filter(Boolean);
    } catch {
      return [getStorageUrl(bucket, value)].filter(Boolean);
    }
  }
  return [];
};

const getFirstImage = (value: string[] | null | undefined) => (value?.[0] || '');

const getMarketplaceItemHref = (item: MarketplaceItem) => {
  const slug = String(item.slug || '').trim();
  if (slug) return `/marketplace/${encodeURIComponent(slug)}`;
  return `/marketplace/${item.source}-${item.id}`;
};

/** Reduce a full address to "City, State" for card display. */
function getCityStateFromLocation(location: string | null | undefined): string {
  const s = (location || '').trim();
  if (!s) return '';
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const statePart = last.replace(/\s*\d{5}(-\d{4})?(\s*$)/, '').trim();
    const state = /^[A-Za-z]{2}$/.test(statePart) ? statePart : statePart.split(/\s+/)[0] || statePart;
    const city = parts[parts.length - 2];
    return [city, state].filter(Boolean).join(', ') || s;
  }
  return s;
}

const getPriceValue = (value: string | number) => {
  if (typeof value === 'number') return value;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeMarketplaceCategory = (value: unknown, fallback = 'General') => {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const key = raw.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (key === 'dealership' || key === 'dealerships' || key === 'car dealership') return 'Cars';
  if (key === 'real_estate') return 'Real Estate';
  // Canonical vehicle bucket for marketplace (matches car / cars / vehicle search & category chips)
  if (
    key === 'car' ||
    key === 'cars' ||
    key === 'vehicle' ||
    key === 'vehicles' ||
    key === 'auto' ||
    key === 'automotive' ||
    key === 'truck' ||
    key === 'trucks' ||
    key === 'suv' ||
    key === 'van' ||
    key === 'pickup' ||
    key === 'sedan' ||
    key === 'motorcycle' ||
    key === 'moto' ||
    key === 'atv' ||
    key === 'dealer' ||
    key === 'dealer lot'
  ) {
    return 'Cars';
  }
  return raw;
};

/** All rows from the dealership (car lot) table belong in the vehicle category for filters/chips. */
const dealershipMarketplaceCategory = 'Cars' as const;

/** How many category chips to show in "Categories for you" before "See more" opens the rest in a modal. */
const MARKETPLACE_INLINE_CATEGORY_CHIPS = 5;

/** Group structured `Parent — Sub` listings by top-level label for category chips; keep legacy normalization otherwise. */
const categoryChipKey = (value: unknown, fallback = 'General') => {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  if (raw.includes(CATEGORY_SEPARATOR)) {
    const p = parseMarketplaceCategoryForForm(raw).parent;
    if (p) return p;
  }
  return normalizeMarketplaceCategory(value, fallback);
};

const shuffleInChunks = <T,>(items: T[], chunkSize = 6) => {
  const result: T[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    for (let j = chunk.length - 1; j > 0; j -= 1) {
      const k = Math.floor(Math.random() * (j + 1));
      [chunk[j], chunk[k]] = [chunk[k], chunk[j]];
    }
    result.push(...chunk);
  }
  return result;
};

/** Random order for category chips; new order whenever marketplace `items` list changes. */
const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const planRank: Record<string, number> = {
  premium: 4,
  growth: 3,
  starter: 2,
  free: 1,
  default: 0,
};

const getPlanRank = (value?: string | null) => {
  const key = (value || '').trim().toLowerCase();
  return planRank[key] ?? planRank.default;
};

const MARKETPLACE_CACHE_KEY = 'hanar_marketplace_cache';
const MARKETPLACE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const USER_LOCATION_SCOPE_KEY = 'userLocationScope';

function readMarketplaceCache(): { ts: number; items: MarketplaceItem[] } | null {
  try {
    const raw = sessionStorage.getItem(MARKETPLACE_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (Date.now() - cache.ts > MARKETPLACE_CACHE_TTL) return null;
    return cache;
  } catch {
    return null;
  }
}

function writeMarketplaceCache(items: MarketplaceItem[]) {
  try {
    sessionStorage.setItem(MARKETPLACE_CACHE_KEY, JSON.stringify({ ts: Date.now(), items }));
  } catch {}
}

export default function MarketplacePage() {
  const { effectiveLang } = useLanguage();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [radius, setRadius] = useState(() => readSavedSearchRadiusMiles(40));
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('');
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(6);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locationSearchValue, setLocationSearchValue] = useState('');
  const [tempRadius, setTempRadius] = useState(() => readSavedSearchRadiusMiles(40));
  const [locationScope, setLocationScope] = useState<MarketplaceLocationScope>({ mode: 'none' });
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [_personalizeBump, setPersonalizeBump] = useState(0);

  const addToRecentSearches = async (term: string) => {
    const t = term.trim().toLowerCase();
    if (!t) return;
    let next: string[] = [];
    setRecentSearches((prev) => {
      next = [t, ...prev.filter((s) => s !== t)].slice(0, RECENT_SEARCHES_MAX);
      return next;
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('user_marketplace_searches')
        .upsert(
          { user_id: user.id, searches: next, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
    } else {
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    }

    // Log for admin marketplace insights (radius: applied filter or null = unlimited)
    const radiusMiles =
      userCoords && (locationScope.mode === 'city_radius' || locationScope.mode === 'none')
        ? radius
        : null;
    void supabase
      .from('marketplace_search_log')
      .insert({
        user_id: user?.id ?? null,
        search_term: t,
        radius_miles: radiusMiles,
      });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') addToRecentSearches(searchTerm);
  };

  const handleSearchBlur = () => {
    if (searchTerm.trim()) addToRecentSearches(searchTerm);
  };

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

    if (result.lat != null && result.lng != null) {
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
  };

  const handleUseMyLocation = () => {
    const applyGeoLabel = async (coords: { lat: number; lon: number }) => {
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
      setLocationLabel(label);
      setLocationSearchValue(label);
      try {
        if (label) localStorage.setItem('userLocationLabel', label);
      } catch {}
      window.dispatchEvent(
        new CustomEvent('location:updated', {
          detail: { ...coords, label, city, state, country, radiusMiles: radius },
        })
      );
    };

    const stored = localStorage.getItem('userCoords');
    if (stored) {
      try {
        const { lat, lon } = JSON.parse(stored);
        const coords = { lat, lon };
        setUserCoords(coords);
        try {
          const rawScope = localStorage.getItem(USER_LOCATION_SCOPE_KEY);
          if (rawScope) setLocationScope(JSON.parse(rawScope) as MarketplaceLocationScope);
          else {
            const geoScope: MarketplaceLocationScope = { mode: 'city_radius', country: '', state: '', city: '' };
            setLocationScope(geoScope);
            localStorage.setItem(USER_LOCATION_SCOPE_KEY, JSON.stringify(geoScope));
          }
        } catch {
          setLocationScope({ mode: 'city_radius', country: '', state: '', city: '' });
        }
        void applyGeoLabel(coords);
        return;
      } catch { /* ignore */ }
    }
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        const scope: MarketplaceLocationScope = { mode: 'city_radius', country: '', state: '', city: '' };
        setLocationScope(scope);
        try {
          localStorage.setItem(USER_LOCATION_SCOPE_KEY, JSON.stringify(scope));
        } catch {}
        setUserCoords(coords);
        localStorage.setItem('userCoords', JSON.stringify(coords));
        void applyGeoLabel(coords);
      },
      () => alert(t(effectiveLang, 'Could not get your location.'))
    );
  };

  const handleApplyLocation = () => {
    setRadius(tempRadius);
    writeSavedSearchRadiusMiles(tempRadius);
    setLocationModalOpen(false);
    setVisibleCount(6);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: favRows } = await supabase
          .from('user_marketplace_favorites')
          .select('item_key, item_snapshot')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });
        const items = (favRows || []).map((r: { item_key: string; item_snapshot: Record<string, unknown> }) => ({
          key: r.item_key,
          id: (r.item_snapshot?.id as string) ?? '',
          source: (r.item_snapshot?.source as 'retail' | 'dealership' | 'individual') ?? 'individual',
          slug: (r.item_snapshot?.slug as string) ?? '',
          title: (r.item_snapshot?.title as string) ?? '',
          price: (r.item_snapshot?.price as string | number) ?? '',
          image: (r.item_snapshot?.image as string) ?? '',
          location: (r.item_snapshot?.location as string) ?? '',
        }));
        setFavoriteItems(items);

        const { data: row } = await supabase
          .from('user_marketplace_searches')
          .select('searches')
          .eq('user_id', user.id)
          .maybeSingle();
        const list = row?.searches;
        if (Array.isArray(list)) {
          setRecentSearches(list.slice(0, RECENT_SEARCHES_MAX).map((s) => String(s)));
        } else {
          setRecentSearches([]);
        }
      } else {
        setFavoriteItems([]);
        const storedRecent = localStorage.getItem(RECENT_SEARCHES_KEY);
        if (storedRecent) {
          try {
            const parsed = JSON.parse(storedRecent) as string[];
            setRecentSearches(Array.isArray(parsed) ? parsed.slice(0, RECENT_SEARCHES_MAX) : []);
          } catch {
            setRecentSearches([]);
          }
        } else {
          setRecentSearches([]);
        }
      }
    })();

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
      } catch {
        /* ignore */
      }
    }

    try {
      const rawScope = localStorage.getItem(USER_LOCATION_SCOPE_KEY);
      if (rawScope) {
        setLocationScope(JSON.parse(rawScope) as MarketplaceLocationScope);
      } else if (saved) {
        setLocationScope({ mode: 'city_radius', country: '', state: '', city: '' });
      }
    } catch {
      /* ignore */
    }

    const handleLocationUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | {
            lat?: number;
            lon?: number;
            lng?: number;
            label?: string;
            city?: string;
            state?: string;
            country?: string;
            radiusMiles?: number;
          }
        | undefined;
      if (detail?.lat != null && detail?.lon != null) {
        setUserCoords({ lat: detail.lat, lon: detail.lon });
        if (detail.label) setLocationLabel(detail.label);
        else setLocationLabel((prev) => prev ?? t(effectiveLang, 'Your location'));
      }
      if (detail?.radiusMiles != null) {
        setRadius(detail.radiusMiles);
        setTempRadius(detail.radiusMiles);
      }
      if (detail && (detail.city != null || detail.state != null || detail.country != null)) {
        const next = scopeFromAddressResult({
          city: detail.city,
          state: detail.state,
          country: detail.country,
          lat: detail.lat,
          lng: detail.lng ?? detail.lon,
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
    const bump = () => setPersonalizeBump((n) => n + 1);
    window.addEventListener('focus', bump);
    window.addEventListener('pageshow', bump);
    return () => {
      window.removeEventListener('focus', bump);
      window.removeEventListener('pageshow', bump);
    };
  }, []);

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      const cache = readMarketplaceCache();
      if (cache) {
        setItems(cache.items);
      } else {
        loadMarketplaceItems();
      }
    }
  }, []);

  const normalizeRetailItem = (row: any): MarketplaceItem => ({
    id: String(row.id),
    title: row.title || row.name || row.item_name || t(effectiveLang, 'Retail item'),
    price: row.price ?? row.amount ?? row.cost ?? '',
    location: row.location || row.city || row.address || '',
    category: normalizeMarketplaceCategory(row.category || row.type, 'Retail'),
    condition: row.condition || row.item_condition || '',
    description: row.description || row.details || null,
    imageUrls: normalizeImages(row.images ?? row.image_url ?? row.image_urls ?? row.photos, 'retail-items'),
    lat: row.lat ?? row.latitude ?? null,
    lon: row.lon ?? row.longitude ?? null,
    created_at: row.created_at || row.createdAt || null,
    slug: row.slug || row.item_slug || row.listing_slug || `retail-${row.id}`,
    source: 'retail',
    business_id: row.business_id || null,
    external_buy_url: row.external_buy_url || null,
  });

  const normalizeDealershipItem = (row: any): MarketplaceItem => ({
    id: String(row.id),
    title: row.title || row.name || row.vehicle_name || row.model || t(effectiveLang, 'Dealership listing'),
    price: row.price ?? row.amount ?? row.cost ?? '',
    location: row.location || row.city || row.address || '',
    // All dealership (car lot) rows count under Cars for category chips, filters, and car/vehicle search
    category: dealershipMarketplaceCategory,
    condition: row.condition || row.item_condition || '',
    description: row.description || row.details || row.notes || null,
    imageUrls: normalizeImages(row.images ?? row.image_url ?? row.image_urls ?? row.photos, 'car-listings'),
    lat: row.lat ?? row.latitude ?? null,
    lon: row.lon ?? row.longitude ?? null,
    created_at: row.created_at || row.createdAt || null,
    slug: row.slug || row.item_slug || row.listing_slug || `dealership-${row.id}`,
    source: 'dealership',
    business_id: row.business_id || null,
    external_buy_url: row.external_buy_url || null,
  });

  const normalizeIndividualItem = (row: any): MarketplaceItem => {
    const raw = row.image_urls ?? row.imageUrls;
    const urls = normalizeImages(raw, 'marketplace-images');
    return {
      id: String(row.id),
      title: row.title || t(effectiveLang, 'Listing'),
      price: row.price ?? '',
      location: row.location || '',
      category: normalizeMarketplaceCategory(row.category, 'General'),
      condition: row.condition || '',
      description: row.description || null,
      imageUrls: urls,
      lat: row.location_lat ?? row.lat ?? row.latitude ?? null,
      lon: row.location_lng ?? row.lon ?? row.longitude ?? null,
      created_at: row.created_at || null,
      slug: `individual-${row.id}`,
      source: 'individual',
      business_id: null,
      user_id: row.user_id || null,
      location_country: row.location_country ?? null,
      location_state: row.location_state ?? null,
      location_city: row.location_city ?? null,
      external_buy_url: row.external_buy_url ?? null,
    };
  };

  const sortByCreatedAt = (a: MarketplaceItem, b: MarketplaceItem) =>
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();

  const normalizeRealEstateItem = (row: Record<string, unknown>): MarketplaceItem => {
    const raw = row.images ?? row.image_url ?? row.image_urls ?? row.photos;
    const imageUrls = normalizeImages(raw, 'real-estate-listings');
    const p = row.price;
    const price: string | number = typeof p === 'number' ? p : typeof p === 'string' ? p : p != null ? String(p) : '';
    return {
      id: String(row.id),
      title: (row.title as string) || t(effectiveLang, 'Real estate listing'),
      price,
      description: (row.description as string) || '',
      category: normalizeMarketplaceCategory((row.property_type as string), 'Real Estate'),
      condition: '',
      location: (row.address as string) || '',
      imageUrls,
      lat: (row.lat as number) ?? (row.latitude as number) ?? null,
      lon: (row.lon as number) ?? (row.longitude as number) ?? null,
      created_at: (row.created_at as string) || null,
      business_id: (row.business_id as string) || null,
      source: 'real_estate',
      slug: `real-estate-${row.id}`,
      external_buy_url: (row.external_buy_url as string) || null,
    };
  };

  const loadMarketplaceItems = async () => {
    const [retailRes, dealershipRes, realEstateRes, individualRes] = await Promise.all([
      supabase.from('retail_items').select('*').order('created_at', { ascending: false }),
      supabase.from('dealerships').select('*').order('created_at', { ascending: false }),
      supabase.from('real_estate_listings').select('*').order('created_at', { ascending: false }),
      supabase.from('marketplace_items').select('*').order('created_at', { ascending: false }),
    ]);

    if (retailRes.error || dealershipRes.error) {
      console.error('Failed to load marketplace items', retailRes.error || dealershipRes.error);
      setItems([]);
      return;
    }

    const retail = (retailRes.data || []).map(normalizeRetailItem);
    const dealership = (dealershipRes.data || []).map(normalizeDealershipItem);
    const realEstate = (realEstateRes.data || []).map((row: Record<string, unknown>) => normalizeRealEstateItem(row));
    const nowIso = new Date().toISOString();
    const individual = (individualRes.data || [])
      .filter((row: { expires_at?: string | null; is_on_hold?: boolean | null }) =>
        (!row.expires_at || row.expires_at >= nowIso) && !row.is_on_hold
      )
      .map(normalizeIndividualItem);
    const combined = [...retail, ...dealership, ...realEstate, ...individual].sort(sortByCreatedAt);
    const businessIds = Array.from(
      new Set(combined.map((item) => item.business_id).filter(Boolean) as string[])
    );
    const parseBusinessAddress = (address: unknown): { city: string; state: string; country: string } => {
      const empty = { city: '', state: '', country: '' };
      if (address == null) return empty;
      let obj: { city?: string; state?: string; country?: string } | null = null;
      if (typeof address === 'object' && !Array.isArray(address)) {
        obj = address as { city?: string; state?: string; country?: string };
      } else if (typeof address === 'string') {
        try {
          const parsed = JSON.parse(address) as { city?: string; state?: string; country?: string };
          if (parsed && typeof parsed === 'object') obj = parsed;
        } catch {
          return empty;
        }
      }
      if (!obj) return empty;
      return {
        city: typeof obj.city === 'string' ? obj.city : '',
        state: typeof obj.state === 'string' ? obj.state : '',
        country: typeof obj.country === 'string' ? obj.country : '',
      };
    };

    let verifiedMap = new Map<string, boolean>();
    let planMap = new Map<string, string>();
    let businessLocationMap = new Map<string, string>();
    let businessAddressPartsMap = new Map<string, { city: string; state: string; country: string }>();
    let businessCoordsMap = new Map<string, { lat: number; lon: number }>();
    if (businessIds.length > 0) {
      const { data: businessRows } = await supabase
        .from('businesses')
        .select('id, is_verified, plan, address, lat, lon')
        .in('id', businessIds);
      verifiedMap = new Map(
        (businessRows || []).map((row: { id: string; is_verified?: boolean | null; plan?: string | null }) => [
          row.id,
          Boolean(row.is_verified),
        ])
      );
      planMap = new Map(
        (businessRows || []).map((row: { id: string; plan?: string | null }) => [row.id, row.plan || ''])
      );
      businessAddressPartsMap = new Map(
        (businessRows || []).map((row: { id: string; address?: unknown }) => {
          const p = parseBusinessAddress(row.address);
          return [row.id, p] as [string, { city: string; state: string; country: string }];
        })
      );
      businessLocationMap = new Map(
        (businessRows || []).map((row: { id: string; address?: unknown }) => {
          const p = parseBusinessAddress(row.address);
          const loc = [p.city, p.state].filter(Boolean).join(', ');
          return [row.id, loc] as [string, string];
        }).filter(([, loc]) => loc.length > 0)
      );
      businessCoordsMap = new Map(
        (businessRows || [])
          .map((row: { id: string; lat?: number | null; lon?: number | null; address?: unknown }) => {
            const ll = resolveLatLon(
              { lat: row.lat ?? undefined, lon: row.lon ?? undefined },
              row.address
            );
            return ll ? ([row.id, ll] as [string, { lat: number; lon: number }]) : null;
          })
          .filter((entry): entry is [string, { lat: number; lon: number }] => entry != null)
      );
    }
    const withMetadata = combined.map((item) => {
      const businessLocation = item.business_id ? businessLocationMap.get(item.business_id) : null;
      const location =
        (businessLocation && businessLocation.length > 0)
          ? businessLocation
          : (item.location && String(item.location).trim()) || '';
      const businessCoords = item.business_id ? businessCoordsMap.get(item.business_id) : null;
      const addrParts = item.business_id ? businessAddressPartsMap.get(item.business_id) : undefined;
      return {
        ...item,
        location: location || item.location || '',
        lat: item.lat ?? businessCoords?.lat ?? null,
        lon: item.lon ?? businessCoords?.lon ?? null,
        location_country: item.location_country || addrParts?.country || null,
        location_state: item.location_state || addrParts?.state || null,
        location_city: item.location_city || addrParts?.city || null,
        business_verified: item.business_id ? verifiedMap.get(item.business_id) || false : false,
        business_plan: item.business_id ? planMap.get(item.business_id) || null : null,
      };
    });
    const ranked = withMetadata.sort((a, b) => {
      const planDelta = getPlanRank(b.business_plan) - getPlanRank(a.business_plan);
      if (planDelta !== 0) return planDelta;
      return sortByCreatedAt(b, a);
    });
    const final = shuffleInChunks(ranked, 8);
    setItems(final);
    writeMarketplaceCache(final);
  };

  const getFavoriteKey = (item: MarketplaceItem) => `${item.source}:${item.id}`;

  const toggleFavorite = async (item: MarketplaceItem) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const key = getFavoriteKey(item);
    const isFav = favoriteItems.some((fav) => fav.key === key);
    if (isFav) {
      const { error } = await supabase
        .from('user_marketplace_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('item_key', key);
      if (!error) setFavoriteItems((prev) => prev.filter((fav) => fav.key !== key));
    } else {
      const snapshot = {
        id: item.id,
        source: item.source,
        slug: item.slug,
        title: item.title,
        price: item.price,
        image: getFirstImage(item.imageUrls) || '/placeholder.jpg',
        location: item.location ?? '',
      };
      const { error } = await supabase.from('user_marketplace_favorites').insert({
        user_id: user.id,
        item_key: key,
        item_snapshot: snapshot,
      });
      if (!error)
        setFavoriteItems((prev) => [...prev, { key, ...snapshot }]);
    }
  };

  const favoriteKeys = new Set(favoriteItems.map((fav) => fav.key));

  const normalizeToken = (value: string) => value.toLowerCase().trim();
  const tokens = searchTerm
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const synonymMap: Record<string, string[]> = {
    car: ['cars', 'vehicle', 'auto', 'dealership', 'dealer'],
    cars: ['car', 'vehicle', 'auto', 'dealership', 'dealer'],
    vehicle: ['car', 'auto', 'dealership', 'dealer'],
    truck: ['trucks', 'vehicle', 'auto', 'dealership', 'dealer'],
    bike: ['bikes', 'motorcycle', 'motorbike'],
    clothes: ['cloths', 'clothing', 'apparel', 'outfit', 'suit', 'suits'],
    cloths: ['clothes', 'clothing', 'apparel', 'outfit', 'suit', 'suits'],
    suit: ['suits', 'clothes', 'clothing', 'apparel'],
    shoes: ['shoe', 'sneakers', 'boots'],
    phone: ['phones', 'mobile', 'iphone', 'android'],
    laptop: ['laptops', 'computer', 'pc', 'macbook'],
  };

  const expandedTermGroups = tokens.map((token) => {
    const base = normalizeToken(token);
    const synonyms = synonymMap[base] || [];
    return Array.from(new Set([base, ...synonyms.map(normalizeToken)]));
  });

  const expandedTerms = Array.from(new Set(expandedTermGroups.flat()));

  const wantsDealership = expandedTerms.some((t) =>
    ['car', 'cars', 'vehicle', 'auto', 'truck', 'dealer', 'dealership', 'motorcycle'].includes(t)
  );

  const wantsRetail = expandedTerms.some((t) =>
    ['clothes', 'cloths', 'clothing', 'apparel', 'suit', 'suits', 'shoes', 'phone', 'laptop'].includes(t)
  );

  const matchesSearch = (value: string, termList: string[]) =>
    termList.length === 0 ? true : termList.some((t) => value.includes(t));

  const matchesAllGroups = (value: string, groups: string[][]) =>
    groups.length === 0 ? true : groups.every((group) => matchesSearch(value, group));

  const hasSearchTerm = tokens.length > 0;
  const hasCategoryFilter = Boolean(selectedCategoryFilter);
  const shouldFilterByCategoryOrSearch = hasSearchTerm || hasCategoryFilter;

  let filteredItems = [...items];
  if (shouldFilterByCategoryOrSearch) {
    filteredItems = items.filter((item) => {
      if (selectedCategoryFilter && categoryChipKey(item.category, 'General') !== selectedCategoryFilter) {
        return false;
      }
      if (!hasSearchTerm) return true;
      const title = (item.title || '').toLowerCase();
      const location = (item.location || '').toLowerCase();
      const category = (item.category || '').toLowerCase();
      const description = (item.description || '').toLowerCase();
      const searchable = `${title} ${category} ${location} ${description}`.trim();
      return matchesAllGroups(searchable, expandedTermGroups);
    });

    // Preserve broad intent shortcuts only when search terms are active.
    if (hasSearchTerm && expandedTerms.length > 0) {
      if (wantsDealership && !wantsRetail) {
        const dealershipItems = filteredItems.filter((item) => item.source === 'dealership');
        if (dealershipItems.length > 0) filteredItems = dealershipItems;
      } else if (wantsRetail && !wantsDealership) {
        const retailItems = filteredItems.filter((item) => item.source === 'retail');
        if (retailItems.length > 0) filteredItems = retailItems;
      }
    }
  }

  filteredItems.sort((a, b) => {
    if (sort === 'priceLow') return (getPriceValue(a.price) || 0) - (getPriceValue(b.price) || 0);
    if (sort === 'priceHigh') return (getPriceValue(b.price) || 0) - (getPriceValue(a.price) || 0);
    if (sort === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    if (sort === 'distance' && userCoords) {
      const aHasCoords = a.lat != null && a.lon != null;
      const bHasCoords = b.lat != null && b.lon != null;
      if (aHasCoords && bHasCoords) {
        const aDist = getDistanceMiles(userCoords.lat, userCoords.lon, a.lat as number, a.lon as number);
        const bDist = getDistanceMiles(userCoords.lat, userCoords.lon, b.lat as number, b.lon as number);
        return aDist - bDist;
      }
      if (aHasCoords && !bHasCoords) return -1;
      if (!aHasCoords && bHasCoords) return 1;
      return 0;
    }
    if (userCoords) {
      const aHasCoords = a.lat != null && a.lon != null;
      const bHasCoords = b.lat != null && b.lon != null;
      if (aHasCoords && bHasCoords) {
        const aDist = getDistanceMiles(userCoords.lat, userCoords.lon, a.lat as number, a.lon as number);
        const bDist = getDistanceMiles(userCoords.lat, userCoords.lon, b.lat as number, b.lon as number);
        return aDist - bDist;
      }
      if (aHasCoords && !bHasCoords) return -1;
      if (!aHasCoords && bHasCoords) return 1;
    }
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });

  const itemCategorySignature = filteredItems
    .map((i) => categoryChipKey(i.category, 'General'))
    .sort()
    .join('\u0001');

  const allCategories = useMemo(() => {
    const keySet = new Set<string>();
    for (const item of filteredItems) {
      const key = categoryChipKey(item.category, 'General');
      if (key) keySet.add(key);
    }
    const arr = Array.from(keySet);
    if (arr.length === 0) return [];
    return shuffleArray(arr);
  }, [itemCategorySignature]);

  const topCategories = allCategories.slice(0, MARKETPLACE_INLINE_CATEGORY_CHIPS);
  const extraCategories = allCategories.slice(MARKETPLACE_INLINE_CATEGORY_CHIPS);

  const displayedItems = filteredItems.slice(0, visibleCount);

  useEffect(() => {
    const target = bottomRef.current;
    if (!target) return;
    if (visibleCount >= filteredItems.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setVisibleCount((count) => Math.min(count + 12, filteredItems.length));
      },
      { rootMargin: '200px 0px', threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [visibleCount, filteredItems.length]);

  const handlePullRefresh = useCallback(async () => {
    try { sessionStorage.removeItem(MARKETPLACE_CACHE_KEY); } catch {}
    setVisibleCount(6);
    await loadMarketplaceItems();
  }, []);

  const handleCategoryClick = (category: string) => {
    setSelectedCategoryFilter(category);
    setVisibleCount(10);
    setCategoriesModalOpen(false);
  };

  const handleAllCategoriesClick = () => {
    setSelectedCategoryFilter(null);
    setVisibleCount(6);
    setCategoriesModalOpen(false);
  };

  const ItemCard = ({ item }: { item: MarketplaceItem }) => (
    <div className="relative h-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <button
        type="button"
        onClick={() => toggleFavorite(item)}
        className="absolute right-1.5 top-1.5 z-10 rounded-full bg-white/95 p-1 shadow-sm ring-1 ring-black/10 transition hover:bg-white active:scale-95"
        aria-label={favoriteKeys.has(getFavoriteKey(item)) ? t(effectiveLang, 'Remove from favorites') : t(effectiveLang, 'Add to favorites')}
      >
        {favoriteKeys.has(getFavoriteKey(item)) ? (
          <FaHeart className="h-3 w-3 text-rose-500" />
        ) : (
          <FaRegHeart className="h-3 w-3 text-slate-500" />
        )}
      </button>
      <Link
        href={getMarketplaceItemHref(item)}
        onClick={() => {
          recordMarketplaceItemView({
            source: item.source,
            id: item.id,
            title: item.title || '',
            category: item.category || '',
          });
        }}
        className="group relative flex h-full flex-col"
      >
        <div className="relative aspect-square overflow-hidden bg-slate-100">
          <img
            src={getFirstImage(item.imageUrls) || '/placeholder.jpg'}
            alt={item.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {item.external_buy_url && (
            <span className="absolute left-1.5 top-1.5 max-w-[calc(100%-0.5rem)] inline-flex items-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-semibold leading-tight text-white shadow-sm sm:left-2 sm:top-2 sm:max-w-[calc(100%-1rem)] sm:px-2 sm:text-[10px]">
              {t(effectiveLang, 'Available online')}
            </span>
          )}
        </div>

        <div className="flex flex-grow flex-col p-2">
          <p className="text-[13px] font-semibold leading-none text-slate-900">
            {getPriceValue(item.price) === null ? item.price : `$${getPriceValue(item.price)}`}
          </p>
          <h3 className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-snug text-slate-800 transition-colors group-hover:text-slate-950">
            {item.title}
          </h3>
          {item.location && (
            <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500">
              {getCityStateFromLocation(item.location) || item.location}
            </p>
          )}
          {item.condition && (
            <span className="mt-1 inline-flex w-fit items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700">
              {item.condition}
            </span>
          )}
          {item.business_id && (
            <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700">
              {item.business_verified ? t(effectiveLang, 'Verified seller') : t(effectiveLang, 'Business seller')}
            </span>
          )}
        </div>
      </Link>
    </div>
  );

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
    <div className="min-h-screen bg-[#eaeded] pb-10 dark:bg-[#111827]">
    <div className="mx-auto max-w-[66rem] px-3 pt-0">
      {/* Search and location bar (Hanar nav gradient — matches home Ask strip) */}
      <div className="sticky top-0 z-10 mb-0 border border-slate-200 bg-slate-100 px-3 pb-3 pt-2 shadow-sm dark:border-slate-200 dark:bg-slate-100">
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => { setLocationModalOpen(true); setTempRadius(radius); }}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <FaMapMarkerAlt className="h-3.5 w-3.5 text-slate-600" />
              <span className="max-w-[11rem] truncate">{locationLabel || t(effectiveLang, 'Choose marketplace location')}</span>
              {locationLabel && locationScope.mode === 'country' && <span className="text-[10px] text-slate-500">{t(effectiveLang, 'Country')}</span>}
              {locationLabel && locationScope.mode === 'state' && <span className="text-[10px] text-slate-500">{t(effectiveLang, 'State')}</span>}
              {locationLabel && (locationScope.mode === 'city_radius' || locationScope.mode === 'none') && userCoords && (
                <span className="text-[10px] text-slate-500">{radius} mi</span>
              )}
            </button>
            <div className="pointer-events-none inline-flex items-center gap-1.5 rounded-md border border-pink-400 bg-gradient-to-r from-pink-500 to-[#0030ff] px-3 py-1 text-[13px] font-extrabold uppercase tracking-[0.08em] text-white shadow-md">
              <Store className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              <span>Marketplace</span>
            </div>
          </div>

          <div className="flex overflow-hidden rounded-md border border-pink-400 bg-gradient-to-r from-black/70 via-pink-500 to-pink-400 shadow-sm">
              <div className="hidden items-center border-r border-white/20 bg-black/55 px-3 text-[11px] font-medium text-white sm:flex">
                {t(effectiveLang, 'All categories')}
            </div>
            <button
              type="button"
              onClick={() => {
                if (searchTerm.trim()) void addToRecentSearches(searchTerm);
              }}
              className="inline-flex items-center justify-center border-r border-white/20 bg-black/55 px-4 text-white transition hover:bg-black/70"
              aria-label={t(effectiveLang, 'Search marketplace')}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <div className="relative min-w-0 flex-1">
              <input
                type="text"
                placeholder={t(effectiveLang, 'Search Hanar Marketplace')}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedCategoryFilter(null);
                }}
                onKeyDown={handleSearchKeyDown}
                onBlur={handleSearchBlur}
                className="w-full border-0 bg-white py-2.5 pl-3 pr-10 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                  aria-label={t(effectiveLang, 'Clear search')}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Location modal – portal so always in view */}
      {locationModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/35 backdrop-blur-[2px] p-2 pt-12"
          onClick={() => setLocationModalOpen(false)}
        >
          <div className="w-full max-w-[20rem] rounded-xl border border-slate-200/90 bg-white/95 p-3 shadow-2xl ring-1 ring-black/5 backdrop-blur dark:border-gray-700/80 dark:bg-gray-900/95" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2.5 flex items-center justify-between">
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
            <p className="mb-2.5 text-[11px] text-slate-500 dark:text-gray-400">
              {t(effectiveLang, 'Type a country (e.g. United States), a state or region, or a city. Country and state show all matching listings; city uses the radius below.')}
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{t(effectiveLang, 'Country, state, or city')}</label>
                <AddressAutocomplete
                  value={locationSearchValue}
                  onSelect={handleLocationSelect}
                  onChange={setLocationSearchValue}
                  placeholder={t(effectiveLang, 'Search city, ZIP, or address...')}
                  mode="locality"
                  className="w-full"
                  inputClassName="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <button
                type="button"
                onClick={handleUseMyLocation}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-emerald-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-emerald-900/30"
              >
                <FaMapMarkerAlt className="w-4 h-4 text-emerald-600" />
                {t(effectiveLang, 'Use my current location')}
              </button>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{t(effectiveLang, 'Radius')}: {tempRadius} {t(effectiveLang, 'miles')}</label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={tempRadius}
                  onChange={(e) => setTempRadius(Number(e.target.value))}
                  className="h-2 w-full appearance-none rounded-lg bg-slate-200 accent-emerald-500 dark:bg-gray-600"
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
                onClick={handleApplyLocation}
                className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
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
          className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/35 p-3 pt-16 backdrop-blur-[2px]"
          onClick={() => setCategoriesModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-[#d5d9d9] bg-white p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-[#0f1111]">
                {t(effectiveLang, 'More categories')}
              </h3>
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
                  onClick={handleAllCategoriesClick}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#d5d9d9] bg-[#e7f4f5] px-3 py-1 text-[11px] font-semibold text-[#007185] transition hover:border-[#c7caca] hover:bg-[#dff0f2]"
                >
                  <span aria-hidden>🌐</span>
                  <span>{t(effectiveLang, 'All categories')}</span>
                </button>
                {extraCategories.map((category) => {
                  const emoji = getMarketplaceCategoryIcon(category);
                  return (
                    <button
                      key={`all-cat-${category}`}
                      type="button"
                      onClick={() => handleCategoryClick(category)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#d5d9d9] bg-[#f0f2f2] px-3 py-1 text-[11px] font-semibold text-[#0f1111] transition hover:border-[#c7caca] hover:bg-[#e7e9ec]"
                    >
                      <span aria-hidden>{emoji}</span>
                      <span>{t(effectiveLang, category)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {items.length > 0 && (
        <>
          {topCategories.length > 0 && (
            <section className="mb-3 rounded-lg border border-[#d5d9d9] bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-[16px] font-bold text-[#0f1111]">{t(effectiveLang, 'Categories for you')}</h2>
                {extraCategories.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setCategoriesModalOpen(true)}
                    className="text-[11px] font-semibold text-[#007185] hover:text-[#c7511f]"
                  >
                    {t(effectiveLang, 'See more')}
                  </button>
                ) : (
                  <span className="text-[11px] text-[#565959]">{t(effectiveLang, 'Tap to filter')}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAllCategoriesClick}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#d5d9d9] bg-[#e7f4f5] px-3 py-1 text-[11px] font-semibold text-[#007185] transition hover:border-[#c7caca] hover:bg-[#dff0f2]"
                >
                  <span aria-hidden>🌐</span>
                  <span>{t(effectiveLang, 'All categories')}</span>
                </button>
                {topCategories.map((category) => {
                  const emoji = getMarketplaceCategoryIcon(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => handleCategoryClick(category)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#d5d9d9] bg-[#f0f2f2] px-3 py-1 text-[11px] font-semibold text-[#0f1111] transition hover:border-[#c7caca] hover:bg-[#e7e9ec]"
                    >
                      <span aria-hidden>{emoji}</span>
                      <span>{t(effectiveLang, category)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

        </>
      )}

      {/* Items */}
      {items.length === 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-lg bg-gradient-to-r from-[#d6d8dc] via-[#eef0f2] to-[#d6d8dc] p-[2px] dark:from-[#3f454d] dark:via-[#5b6470] dark:to-[#3f454d]"
            >
              <div className="overflow-hidden rounded-[6px] bg-gradient-to-r from-[#e3e5e8] via-[#f7f8fa] to-[#e3e5e8] dark:from-[#4a515b] dark:via-[#6a7380] dark:to-[#4a515b]">
                <div className="skeleton aspect-[5/3] w-full rounded-none" />
                <div className="space-y-2 bg-gradient-to-b from-[#f4f5f7] to-[#e7eaee] p-2.5 dark:from-gray-900 dark:to-black">
                  <div className="skeleton h-3.5 w-1/3 rounded-full" />
                  <div className="skeleton h-3.5 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t(effectiveLang, 'Recommended Listings')}</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">{filteredItems.length} {t(effectiveLang, 'results')}</span>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {displayedItems.map((item) => (
          <ItemCard key={`${item.source}-${item.id}`} item={item} />
        ))}
      </div>

      {filteredItems.length > visibleCount && (
        <div ref={bottomRef} className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          {t(effectiveLang, 'Loading more listings...')}
        </div>
      )}

      {/* Empty & Pagination */}
      {items.length > 0 && filteredItems.length === 0 && (
        <p className="text-center text-gray-500 mt-6">{t(effectiveLang, 'No results found. Try changing your search or filters.')}</p>
      )}
    </div>
    </div>
    </PullToRefresh>
  );
}
