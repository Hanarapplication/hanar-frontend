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

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) / 1.60934;
}

const categoryColors: Record<string, string> = {
  Restaurant: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-700',
  'Car Dealership': 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700',
  Dealership: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700',
  Retail: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700',
  Cafe: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700',
  'Coffee Shop': 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700',
  'Hair Salon': 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-700',
  'Beauty Salon': 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-700',
  Gym: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700',
  Fitness: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700',
  'Pet Store': 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-900/40 dark:text-cyan-200 dark:border-cyan-700',
  Clinic: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700',
  'Medical Center': 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700',
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

function getCityState(address: any): string {
  if (!address) return 'Location not available';

  if (typeof address === 'string') {
    const parts = address.split(',').map((p: string) => p.trim());
    if (parts.length >= 2) {
      const potentialState = parts[parts.length - 1].split(' ')[0];
      const potentialCity = parts[parts.length - 2];
      if (potentialState.length <= 3 && /[A-Z]{2}/.test(potentialState)) {
        return `${potentialCity}, ${potentialState}`;
      }
    }
    return address;
  }

  if (typeof address === 'object' && address !== null) {
    const city = address.city || address.town || address.locality || '';
    const state = address.state || address.state_code || address.province || address.region || '';
    if (city && state) return `${city}, ${state}`;
    if (city) return city;
    if (state) return state;
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
  const [radius, setRadius] = useState(50);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [tempRadius, setTempRadius] = useState(50);
  const [locationSearchValue, setLocationSearchValue] = useState('');
  const [visibleCount, setVisibleCount] = useState(6);
  const bottomRef = useRef<HTMLDivElement>(null);
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
        setLocationLabel('Your location');
        try {
          localStorage.setItem('userCoords', JSON.stringify(coords));
          localStorage.setItem('userLocationLabel', 'Your location');
        } catch {}
        window.dispatchEvent(new CustomEvent('location:updated', { detail: coords }));
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
      const detail = (e as CustomEvent).detail as { lat?: number; lon?: number; label?: string } | undefined;
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
  const speaksUserLang = (b: Business) => {
    const langs = b.spoken_languages;
    if (!langs || !Array.isArray(langs) || langs.length === 0) return false;
    return langs.includes(effectiveLang);
  };
  const isPremium = (b: Business) => (b.plan || '').toLowerCase() === 'premium';
  const cityFromLabel = (locationLabel || '').split(',')[0]?.trim().toLowerCase() || '';
  const filtered = businesses
    .filter((b) => {
      if (normalizedQuery) {
        const matchesText =
          b.business_name.toLowerCase().includes(normalizedQuery) ||
          (b.category || '').toLowerCase().includes(normalizedQuery) ||
          (b.subcategory || '').toLowerCase().includes(normalizedQuery) ||
          (b.description || '').toLowerCase().includes(normalizedQuery) ||
          getCityState(b.address).toLowerCase().includes(normalizedQuery);
        if (!matchesText && !relatedBusinessIds.has(b.id)) return false;
      }
      if (userCoords) {
        if (b.lat != null && b.lon != null) {
          return getDistanceMiles(userCoords.lat, userCoords.lon, b.lat, b.lon) <= radius;
        }
        if (!cityFromLabel || cityFromLabel === 'your location') return false;
        const loc = getCityState(b.address).toLowerCase();
        return new RegExp(`\\b${cityFromLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(loc);
      }
      return true;
    })
    .sort((a, b) => {
      if (userCoords) {
        const aHasCoords = a.lat != null && a.lon != null;
        const bHasCoords = b.lat != null && b.lon != null;
        if (aHasCoords && bHasCoords) {
          const aDist = getDistanceMiles(userCoords.lat, userCoords.lon, a.lat!, a.lon!);
          const bDist = getDistanceMiles(userCoords.lat, userCoords.lon, b.lat!, b.lon!);
          if (aDist !== bDist) return aDist - bDist;
        } else if (aHasCoords && !bHasCoords) return -1;
        else if (!aHasCoords && bHasCoords) return 1;
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

  const visible = filtered.slice(0, visibleCount);

  const handlePullRefresh = useCallback(async () => {
    try { sessionStorage.removeItem(BUSINESSES_CACHE_KEY); } catch {}
    setVisibleCount(6);
    await fetchBusinesses();
  }, []);

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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pb-10 sm:pb-12">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8 pt-2 sm:pt-3">
        {/* Search with location inside - modern style */}
        <div className="sticky top-0 z-10 -mx-3 sm:-mx-5 px-3 sm:px-5 pt-0 pb-4 mb-5 sm:mb-6">
          <div className="max-w-3xl mx-auto flex items-stretch gap-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/80 rounded-2xl shadow-lg shadow-gray-200/50 dark:shadow-black/20 overflow-hidden transition-shadow hover:shadow-xl hover:shadow-gray-200/60 dark:hover:shadow-black/30">
            <div className="relative flex-1 min-w-0">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 h-5 w-5 pointer-events-none" />
              <input
                placeholder={t(effectiveLang, 'Find a restaurant, salon, gym...')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-transparent text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none border-0"
              />
              {searching && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400">
                  {t(effectiveLang, 'Searching…')}
                </span>
              )}
            </div>
            <div className="w-px bg-gray-200/80 dark:bg-gray-600/80 flex-shrink-0" />
            <button
              type="button"
              onClick={() => { setLocationModalOpen(true); setTempRadius(radius); }}
              className="flex items-center gap-2 px-4 sm:px-5 h-full min-h-[56px] text-left hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors"
            >
              <FaMapMarkerAlt className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[110px] sm:max-w-[140px]">
                {locationLabel || t(effectiveLang, 'Location')}
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
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{t(effectiveLang, 'Search in this area')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-2">{t(effectiveLang, 'City or address')}</label>
                  <AddressAutocomplete
                    value={locationSearchValue}
                    onSelect={handleLocationSelect}
                    onChange={setLocationSearchValue}
                    placeholder="Search city, ZIP, or address..."
                    mode="locality"
                    className="w-full"
                    inputClassName="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-gray-300 font-medium text-sm transition-colors"
                >
                  <FaMapMarkerAlt className="w-4 h-4 text-blue-500" />
                  {t(effectiveLang, 'Use my current location')}
                </button>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-2">{t(effectiveLang, 'Radius')}: {tempRadius} {t(effectiveLang, 'miles')}</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={tempRadius}
                    onChange={(e) => setTempRadius(Number(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none bg-slate-200 dark:bg-gray-600 accent-blue-500"
                  />
                </div>
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setLocationModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-gray-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {t(effectiveLang, 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => { setRadius(tempRadius); setLocationModalOpen(false); setVisibleCount(6); }}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 dark:bg-blue-500 text-white font-medium text-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                >
                  {t(effectiveLang, 'Apply')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Cards – 2 per row on mobile, description always visible */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {visible.map((biz) => {
            const displayCategory = formatBusinessCategory(biz.subcategory || biz.category);
            const catColor = categoryColors[displayCategory] || categoryColors.default;
            const locationText = getCityState(biz.address);

            return (
              <Link
                key={biz.id}
                href={`/business/${biz.slug}`}
                className="group bg-gradient-to-b from-blue-50/60 to-blue-50/30 dark:from-gray-800 dark:to-gray-800 rounded-lg sm:rounded-xl overflow-hidden shadow-sm hover:shadow-md dark:shadow-gray-900/50 transition-all duration-300 border border-blue-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-gray-500 hover:-translate-y-0.5 flex flex-col h-full text-sm sm:text-base"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-blue-50 dark:bg-gray-700">
                  <img
                    src={biz.logo_url || `https://images.unsplash.com/photo-1557426272-fc91fdb8f385?w=800&auto=format&fit=crop`}
                    alt={biz.business_name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <button
                    onClick={(e) => toggleFavorite(e, biz.id)}
                    className="absolute top-2 right-2 p-1.5 sm:p-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full shadow hover:bg-white dark:hover:bg-gray-700 transition active:scale-95"
                  >
                    {favorites.includes(biz.id) ? (
                      <FaHeart className="h-4 w-4 sm:h-5 sm:w-5 text-rose-500 dark:text-rose-400" />
                    ) : (
                      <FaRegHeart className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 dark:text-gray-400" />
                    )}
                  </button>
                  {isPremium(biz) && (
                    <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-0.5 rounded-md bg-amber-500/90 backdrop-blur-sm px-1.5 py-[2px] text-[9px] font-bold text-white shadow-sm">
                      <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.39c-.833.068-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.494c.714.437 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.583-.536-1.65l-4.752-.391-1.831-4.401z" clipRule="evenodd" /></svg>
                      Premium
                    </span>
                  )}
                </div>

                <div className="p-2.5 sm:p-3.5 flex flex-col flex-grow">
                  <div className="flex flex-wrap gap-1 mb-1.5 sm:mb-2">
                    {displayCategory ? (
                      <span className={`inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 text-xs font-medium rounded-full w-fit ${catColor}`}>
                        {displayCategory}
                      </span>
                    ) : null}
                    {speaksUserLang(biz) && (
                      <span className="inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 text-xs font-medium rounded-full w-fit bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700">
                        {t(effectiveLang, 'Speaks your language')}
                      </span>
                    )}
                  </div>

                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors leading-tight line-clamp-2 mb-1 sm:mb-1.5 text-sm sm:text-base">
                    {biz.business_name}
                  </h3>

                  {biz.description && (
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 italic leading-relaxed line-clamp-2 mb-1.5 sm:mb-2">
                      {biz.description}
                    </p>
                  )}

                  <div className="mt-auto inline-block max-w-full rounded border border-blue-700 dark:border-blue-800 bg-blue-700 dark:bg-blue-800 px-1.5 py-0.5">
                    <p className="text-[10px] font-bold text-white line-clamp-1 truncate max-w-[100px]">
                      {locationText === 'Location not available' ? t(effectiveLang, 'Location not available') : locationText}
                    </p>
                  </div>

                  {userCoords && biz.lat != null && biz.lon != null && (
                    <div className="mt-2 inline-flex items-center px-2 py-0.5 bg-blue-100/70 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-xs font-medium rounded-full">
                      ≈ {getDistanceFromLatLonInKm(userCoords.lat, userCoords.lon, biz.lat, biz.lon).toFixed(1)} km
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        <div ref={bottomRef} className="mt-8 sm:mt-10 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          {visible.length < filtered.length ? (
            <span className="inline-flex items-center gap-2">
              <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 dark:border-t-blue-400"></div>
              {t(effectiveLang, 'Loading more...')}
            </span>
          ) : (
            filtered.length === 0 ? t(effectiveLang, 'No matches found') : t(effectiveLang, 'End of list')
          )}
        </div>
      </div>
    </div>
    </PullToRefresh>
  );
}