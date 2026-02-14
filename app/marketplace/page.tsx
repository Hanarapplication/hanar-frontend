'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';

import { FaHeart, FaRegHeart, FaMapMarkerAlt } from 'react-icons/fa';
import { supabase } from '@/lib/supabaseClient';
import PullToRefresh from '@/components/PullToRefresh';
import AddressAutocomplete, { type AddressResult } from '@/components/AddressAutocomplete';

function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [radius, setRadius] = useState(50);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('');
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(6);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locationSearchValue, setLocationSearchValue] = useState('');
  const [tempRadius, setTempRadius] = useState(50);
  const hasFetchedRef = useRef(false);

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
    const radiusMiles = userCoords ? radius : null;
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
    if (result.lat != null && result.lng != null) {
      const coords = { lat: result.lat, lon: result.lng };
      const label = [result.city, result.state].filter(Boolean).join(', ') || result.formatted_address || 'Selected location';
      setUserCoords(coords);
      setLocationLabel(label);
      setLocationSearchValue('');
      try {
        localStorage.setItem('userCoords', JSON.stringify(coords));
        if (label) localStorage.setItem('userLocationLabel', label);
      } catch {}
      window.dispatchEvent(new CustomEvent('location:updated', {
        detail: { ...coords, label, city: result.city, state: result.state, zip: result.zip },
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
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserCoords(coords);
        localStorage.setItem('userCoords', JSON.stringify(coords));
        setLocationLabel('Your location');
        window.dispatchEvent(new CustomEvent('location:updated', { detail: coords }));
      },
      () => alert('Could not get your location.')
    );
  };

  const handleApplyLocation = () => {
    setRadius(tempRadius);
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
          setLocationLabel(savedLabel || 'Your location');
        }
      } catch {
        /* ignore */
      }
    }

    const handleLocationUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail as { lat?: number; lon?: number; label?: string; city?: string } | undefined;
      if (detail?.lat != null && detail?.lon != null) {
        setUserCoords({ lat: detail.lat, lon: detail.lon });
        if (detail.label) setLocationLabel(detail.label);
        else setLocationLabel((prev) => prev ?? 'Your location');
      }
    };
    window.addEventListener('location:updated', handleLocationUpdated);
    return () => window.removeEventListener('location:updated', handleLocationUpdated);
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
    title: row.title || row.name || row.item_name || 'Retail item',
    price: row.price ?? row.amount ?? row.cost ?? '',
    location: row.location || row.city || row.address || '',
    category: row.category || row.type || 'Retail',
    condition: row.condition || row.item_condition || '',
    description: row.description || row.details || null,
    imageUrls: normalizeImages(row.images ?? row.image_url ?? row.image_urls ?? row.photos, 'retail-items'),
    lat: row.lat ?? row.latitude ?? null,
    lon: row.lon ?? row.longitude ?? null,
    created_at: row.created_at || row.createdAt || null,
    slug: row.slug || row.item_slug || row.listing_slug || `retail-${row.id}`,
    source: 'retail',
    business_id: row.business_id || null,
  });

  const normalizeDealershipItem = (row: any): MarketplaceItem => ({
    id: String(row.id),
    title: row.title || row.name || row.vehicle_name || row.model || 'Dealership listing',
    price: row.price ?? row.amount ?? row.cost ?? '',
    location: row.location || row.city || row.address || '',
    category: row.category || row.type || 'Dealership',
    condition: row.condition || row.item_condition || '',
    description: row.description || row.details || row.notes || null,
    imageUrls: normalizeImages(row.images ?? row.image_url ?? row.image_urls ?? row.photos, 'car-listings'),
    lat: row.lat ?? row.latitude ?? null,
    lon: row.lon ?? row.longitude ?? null,
    created_at: row.created_at || row.createdAt || null,
    slug: row.slug || row.item_slug || row.listing_slug || `dealership-${row.id}`,
    source: 'dealership',
    business_id: row.business_id || null,
  });

  const normalizeIndividualItem = (row: any): MarketplaceItem => {
    const raw = row.image_urls ?? row.imageUrls;
    const urls = normalizeImages(raw, 'marketplace-images');
    return {
      id: String(row.id),
      title: row.title || 'Listing',
      price: row.price ?? '',
      location: row.location || '',
      category: row.category || 'General',
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
      title: (row.title as string) || 'Real estate listing',
      price,
      description: (row.description as string) || '',
      category: (row.property_type as string) || 'Real Estate',
      condition: '',
      location: (row.address as string) || '',
      imageUrls,
      lat: (row.lat as number) ?? (row.latitude as number) ?? null,
      lon: (row.lon as number) ?? (row.longitude as number) ?? null,
      created_at: (row.created_at as string) || null,
      business_id: (row.business_id as string) || null,
      source: 'real_estate',
      slug: `real-estate-${row.id}`,
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
    const individual = (individualRes.data || []).map(normalizeIndividualItem);
    const combined = [...retail, ...dealership, ...realEstate, ...individual].sort(sortByCreatedAt);
    const businessIds = Array.from(
      new Set(combined.map((item) => item.business_id).filter(Boolean) as string[])
    );
    let verifiedMap = new Map<string, boolean>();
    let planMap = new Map<string, string>();
    let businessLocationMap = new Map<string, string>();
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
      businessLocationMap = new Map(
        (businessRows || []).map((row: { id: string; address?: { city?: string; state?: string } | string | null }) => {
          let addr: { city?: string; state?: string } | null = null;
          if (row.address) {
            if (typeof row.address === 'object') addr = row.address;
            else if (typeof row.address === 'string') {
              try { addr = JSON.parse(row.address) as { city?: string; state?: string }; } catch { /* ignore */ }
            }
          }
          const city = addr?.city || '';
          const state = addr?.state || '';
          const loc = [city, state].filter(Boolean).join(', ');
          return [row.id, loc] as [string, string];
        }).filter(([, loc]) => loc.length > 0)
      );
      businessCoordsMap = new Map(
        (businessRows || []).filter((row: { lat?: number | null; lon?: number | null }) => row.lat != null && row.lon != null)
          .map((row: { id: string; lat: number; lon: number }) => [row.id, { lat: row.lat, lon: row.lon }] as [string, { lat: number; lon: number }])
      );
    }
    const withMetadata = combined.map((item) => {
      const businessLocation = item.business_id ? businessLocationMap.get(item.business_id) : null;
      const location =
        (businessLocation && businessLocation.length > 0)
          ? businessLocation
          : (item.location && String(item.location).trim()) || '';
      const businessCoords = item.business_id ? businessCoordsMap.get(item.business_id) : null;
      return {
        ...item,
        location: location || item.location || '',
        lat: item.lat ?? businessCoords?.lat ?? null,
        lon: item.lon ?? businessCoords?.lon ?? null,
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

  let filteredItems = items.filter((item) => {
    const title = (item.title || '').toLowerCase();
    const location = (item.location || '').toLowerCase();
    const category = (item.category || '').toLowerCase();
    const description = (item.description || '').toLowerCase();
    const searchable = `${title} ${category} ${location} ${description}`.trim();
    return matchesAllGroups(searchable, expandedTermGroups);
  });

  if (expandedTerms.length > 0) {
    if (wantsDealership && !wantsRetail) {
      const dealershipItems = filteredItems.filter((item) => item.source === 'dealership');
      if (dealershipItems.length > 0) filteredItems = dealershipItems;
    } else if (wantsRetail && !wantsDealership) {
      const retailItems = filteredItems.filter((item) => item.source === 'retail');
      if (retailItems.length > 0) filteredItems = retailItems;
    }
  }

  if (minPrice) {
    const min = parseFloat(minPrice);
    filteredItems = filteredItems.filter((i) => {
      const value = getPriceValue(i.price);
      return value !== null && value >= min;
    });
  }
  if (maxPrice) {
    const max = parseFloat(maxPrice);
    filteredItems = filteredItems.filter((i) => {
      const value = getPriceValue(i.price);
      return value !== null && value <= max;
    });
  }
  if (userCoords) {
    const cityFromLabel = (locationLabel || '').split(',')[0]?.trim().toLowerCase() || '';
    filteredItems = filteredItems.filter((i) => {
      if (i.lat != null && i.lon != null) {
        return getDistanceMiles(userCoords.lat, userCoords.lon, i.lat, i.lon) <= radius;
      }
      if (!cityFromLabel || cityFromLabel === 'your location') return false;
      const loc = (i.location || '').toLowerCase();
      return new RegExp(`\\b${cityFromLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(loc);
    });
  }

  // Relevance: words from current search + recent searches; boost items that match
  const currentSearchWords = tokens.map(normalizeToken).filter((w) => w.length >= 2);
  const recentSearchWords = Array.from(
    new Set(
      recentSearches.flatMap((s) =>
        s
          .toLowerCase()
          .split(/\s+/)
          .map((w) => w.trim())
          .filter((w) => w.length >= 2)
      )
    )
  );
  const allRelevanceWords = Array.from(new Set([...currentSearchWords, ...recentSearchWords]));

  const getRelevanceScore = (item: MarketplaceItem) => {
    const text = `${item.title || ''} ${item.category || ''} ${item.location || ''} ${item.description || ''}`.toLowerCase();
    let score = 0;
    for (const word of allRelevanceWords) {
      if (text.includes(word)) score += currentSearchWords.includes(word) ? 2 : 1;
    }
    return score;
  };

  const withRelevance = filteredItems.map((item) => ({ item, score: getRelevanceScore(item) }));
  withRelevance.sort((a, b) => {
    if (sort === 'priceLow') return (getPriceValue(a.item.price) || 0) - (getPriceValue(b.item.price) || 0);
    if (sort === 'priceHigh') return (getPriceValue(b.item.price) || 0) - (getPriceValue(a.item.price) || 0);
    if (sort === 'newest') return new Date(b.item.created_at || 0).getTime() - new Date(a.item.created_at || 0).getTime();
    if (sort === 'distance' && userCoords) {
      const aHasCoords = a.item.lat != null && a.item.lon != null;
      const bHasCoords = b.item.lat != null && b.item.lon != null;
      if (aHasCoords && bHasCoords) {
        const aDist = getDistanceMiles(userCoords.lat, userCoords.lon, a.item.lat as number, a.item.lon as number);
        const bDist = getDistanceMiles(userCoords.lat, userCoords.lon, b.item.lat as number, b.item.lon as number);
        return aDist - bDist;
      }
      if (aHasCoords && !bHasCoords) return -1;
      if (!aHasCoords && bHasCoords) return 1;
      return 0;
    }
    if (userCoords) {
      const aHasCoords = a.item.lat != null && a.item.lon != null;
      const bHasCoords = b.item.lat != null && b.item.lon != null;
      if (aHasCoords && bHasCoords) {
        const aDist = getDistanceMiles(userCoords.lat, userCoords.lon, a.item.lat as number, a.item.lon as number);
        const bDist = getDistanceMiles(userCoords.lat, userCoords.lon, b.item.lat as number, b.item.lon as number);
        return aDist - bDist;
      }
      if (aHasCoords && !bHasCoords) return -1;
      if (!aHasCoords && bHasCoords) return 1;
    }
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.item.created_at || 0).getTime() - new Date(a.item.created_at || 0).getTime();
  });
  filteredItems = withRelevance.map(({ item }) => item);

  const handlePullRefresh = useCallback(async () => {
    try { sessionStorage.removeItem(MARKETPLACE_CACHE_KEY); } catch {}
    setVisibleCount(6);
    await loadMarketplaceItems();
  }, []);

  const ItemCard = ({ item }: { item: MarketplaceItem }) => (
    <Link
      key={item.id}
      href={`/marketplace/${item.slug}`}
      className="group relative bg-gradient-to-b from-blue-50/60 to-blue-50/30 dark:from-gray-800 dark:to-gray-800 rounded-lg sm:rounded-xl overflow-hidden shadow-sm hover:shadow-md dark:shadow-gray-900/50 transition-all duration-300 border border-blue-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-gray-500 hover:-translate-y-0.5 flex flex-col h-full text-sm sm:text-base"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-700">
        <img
          src={getFirstImage(item.imageUrls) || '/placeholder.jpg'}
          alt={item.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item); }}
          className="absolute top-2 right-2 p-1.5 sm:p-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full shadow hover:bg-white dark:hover:bg-gray-700 transition active:scale-95"
        >
          {favoriteKeys.has(getFavoriteKey(item)) ? (
            <FaHeart className="h-4 w-4 sm:h-5 sm:w-5 text-rose-500 dark:text-rose-400" />
          ) : (
            <FaRegHeart className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 dark:text-gray-400" />
          )}
        </button>
        {item.business_id && (
          item.business_verified ? (
            <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-0.5 rounded-md bg-emerald-500/90 backdrop-blur-sm px-1.5 py-[2px] text-[9px] font-bold text-white shadow-sm">
              <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-5.11-1.36a.75.75 0 10-1.085-1.035l-2.165 2.27-.584-.614a.75.75 0 10-1.085 1.035l1.126 1.182a.75.75 0 001.085 0l2.708-2.839z" clipRule="evenodd" /></svg>
              Verified
            </span>
          ) : (
            <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-0.5 rounded-md bg-indigo-500/90 backdrop-blur-sm px-1.5 py-[2px] text-[9px] font-bold text-white shadow-sm">
              <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1.581.814L10 13.197l-4.419 3.617A1 1 0 014 16V4z" clipRule="evenodd" /></svg>
              Business
            </span>
          )
        )}
      </div>

      <div className="p-3 sm:p-4 flex flex-col flex-grow">
        <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-snug line-clamp-2 text-[15px] sm:text-base tracking-tight mb-1.5">
          {item.title}
        </h3>
        <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mb-2">
          {getPriceValue(item.price) === null ? item.price : `$${getPriceValue(item.price)}`}
        </p>
        {item.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2 mb-2">
            {item.description}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2">
          {item.category && (
            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200 truncate max-w-[120px]">
              {item.category}
            </span>
          )}
          {item.condition && (
            <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full ${
              item.condition === 'New'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200'
            }`}>
              {item.condition}
            </span>
          )}
          {item.location && (
            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 truncate max-w-[120px]">
              {getCityStateFromLocation(item.location) || item.location}
            </span>
          )}
        </div>
      </div>
    </Link>
  );

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pb-10 sm:pb-12">
    <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8 pt-0 sm:pt-1">
      {/* Search with location inside - modern style */}
      <div className="sticky top-0 z-10 -mx-3 sm:-mx-5 px-3 sm:px-5 pt-0 pb-3 mb-6">
        <div className="relative max-w-2xl mx-auto flex items-stretch gap-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/80 rounded-2xl shadow-lg shadow-gray-200/50 dark:shadow-black/20 overflow-hidden transition-shadow hover:shadow-xl hover:shadow-gray-200/60 dark:hover:shadow-black/30">
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search items, phones, cities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onBlur={handleSearchBlur}
              className="w-full pl-12 pr-4 py-4 bg-transparent text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none border-0"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700/50 transition-all"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="w-px bg-gray-200/80 dark:bg-gray-600/80 flex-shrink-0" />
          <button
            type="button"
            onClick={() => { setLocationModalOpen(true); setTempRadius(radius); }}
            className="flex items-center gap-2 px-4 sm:px-5 h-full min-h-[56px] text-left hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors"
          >
            <FaMapMarkerAlt className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[110px] sm:max-w-[140px]">
              {locationLabel || 'Location'}
            </span>
            {locationLabel && (
              <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{radius} mi</span>
            )}
          </button>
        </div>
      </div>

      {/* Location modal – portal so always in view */}
      {locationModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setLocationModalOpen(false)}
        >
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-slate-200 dark:border-gray-700 p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Search in this area</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-2">City or address</label>
                <AddressAutocomplete
                  value={locationSearchValue}
                  onSelect={handleLocationSelect}
                  onChange={setLocationSearchValue}
                  placeholder="Search city, ZIP, or address..."
                  mode="locality"
                  className="w-full"
                  inputClassName="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleUseMyLocation}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-slate-700 dark:text-gray-300 font-medium text-sm transition-colors"
              >
                <FaMapMarkerAlt className="w-4 h-4 text-emerald-600" />
                Use my current location
              </button>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-2">Radius: {tempRadius} miles</label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={tempRadius}
                  onChange={(e) => setTempRadius(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none bg-slate-200 dark:bg-gray-600 accent-emerald-500"
                />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setLocationModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-gray-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyLocation}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Items */}
      {items.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
              <div className="skeleton aspect-[4/3] w-full rounded-none" />
              <div className="p-2.5 sm:p-3.5 space-y-2">
                <div className="skeleton h-3.5 w-1/3 rounded-full" />
                <div className="skeleton h-3.5 w-3/4 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        {filteredItems.slice(0, visibleCount).map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>

      {/* Empty & Pagination */}
      {items.length > 0 && filteredItems.length === 0 && (
        <p className="text-center text-gray-500 mt-6">No results found. Try changing your search or filters.</p>
      )}
      {filteredItems.length > visibleCount && (
        <div className="text-center mt-8 sm:mt-10">
          <button onClick={() => setVisibleCount(visibleCount + 6)} className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 transition text-sm">
            Show More
          </button>
        </div>
      )}
    </div>
    </div>
    </PullToRefresh>
  );
}
