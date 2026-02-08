'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { FaSearch, FaHeart, FaRegHeart } from 'react-icons/fa';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

interface Business {
  id: string;
  business_name: string;
  category: string;
  address: any;
  description?: string;
  logo_url: string;
  slug: string;
  lat?: number;
  lon?: number;
  distance?: number;
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const categoryColors: Record<string, string> = {
  Restaurant: 'bg-rose-100 text-rose-700 border-rose-300',
  'Car Dealership': 'bg-blue-100 text-blue-700 border-blue-300',
  Dealership: 'bg-blue-100 text-blue-700 border-blue-300',
  Retail: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  Cafe: 'bg-amber-100 text-amber-700 border-amber-300',
  'Coffee Shop': 'bg-amber-100 text-amber-700 border-amber-300',
  'Hair Salon': 'bg-purple-100 text-purple-700 border-purple-300',
  'Beauty Salon': 'bg-purple-100 text-purple-700 border-purple-300',
  Gym: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  Fitness: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'Pet Store': 'bg-cyan-100 text-cyan-700 border-cyan-300',
  Clinic: 'bg-blue-100 text-blue-700 border-blue-300',
  'Medical Center': 'bg-blue-100 text-blue-700 border-blue-300',
  Shop: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  Store: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  default: 'bg-gray-100 text-gray-700 border-gray-300',
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
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [relatedBusinessIds, setRelatedBusinessIds] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [visibleCount, setVisibleCount] = useState(6);
  const bottomRef = useRef<HTMLDivElement>(null);
  const searchCacheRef = useRef<Map<string, Set<string>>>(new Map());

  useEffect(() => {
    async function fetchBusinesses() {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, business_name, category, address, description, logo_url, slug, lat, lon')
        .eq('business_status', 'approved');

      if (error) {
        console.error('Supabase fetch error:', error);
        return;
      }
      setBusinesses(data || []);
    }

    fetchBusinesses();
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

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserLocation(coords);
        setBusinesses((prev) =>
          prev.map((b) => ({
            ...b,
            distance: b.lat && b.lon ? getDistanceFromLatLonInKm(coords.lat, coords.lon, b.lat, b.lon) : undefined,
          }))
        );
      },
      (err) => console.warn('Geolocation error', err),
      { enableHighAccuracy: true }
    );
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
  const filtered = businesses
    .filter((b) => {
      if (!normalizedQuery) return true;
      const matchesText =
        b.business_name.toLowerCase().includes(normalizedQuery) ||
        b.category.toLowerCase().includes(normalizedQuery) ||
        (b.description || '').toLowerCase().includes(normalizedQuery) ||
        getCityState(b.address).toLowerCase().includes(normalizedQuery);
      return matchesText || relatedBusinessIds.has(b.id);
    })
    .sort((a, b) => a.business_name.localeCompare(b.business_name));

  const visible = filtered.slice(0, visibleCount);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && setVisibleCount((c) => c + 6),
      { threshold: 0.1 }
    );
    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [filtered]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50 pb-10 sm:pb-12">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8 pt-5 sm:pt-6">
        {/* Search */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-blue-100 -mx-3 sm:-mx-5 px-3 sm:px-5 py-3 sm:py-4 mb-5 sm:mb-6">
          <div className="flex flex-col sm:flex-row gap-2.5 max-w-3xl mx-auto">
            <div className="relative flex-1">
              <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400 h-4.5 w-4.5 sm:h-5 sm:w-5" />
              <input
                placeholder="Find a restaurant, salon, gym..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-3.5 py-3 sm:py-3.5 bg-white border border-blue-200 rounded-lg sm:rounded-xl text-sm sm:text-base placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition shadow-sm"
              />
              {searching && (
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-blue-500">
                  Searching…
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Cards – 2 per row on mobile, description always visible */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {visible.map((biz) => {
            const displayCategory = formatBusinessCategory(biz.category);
            const catColor = categoryColors[displayCategory] || categoryColors.default;
            const locationText = getCityState(biz.address);

            return (
              <Link
                key={biz.id}
                href={`/business/${biz.slug}`}
                className="group bg-gradient-to-b from-blue-50/60 to-blue-50/30 rounded-lg sm:rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border border-blue-200 hover:border-blue-400 hover:-translate-y-0.5 flex flex-col h-full text-sm sm:text-base"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-blue-50">
                  <img
                    src={biz.logo_url || `https://images.unsplash.com/photo-1557426272-fc91fdb8f385?w=800&auto=format&fit=crop`}
                    alt={biz.business_name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <button
                    onClick={(e) => toggleFavorite(e, biz.id)}
                    className="absolute top-2 right-2 p-1.5 sm:p-2 bg-white/90 backdrop-blur-sm rounded-full shadow hover:bg-white transition active:scale-95"
                  >
                    {favorites.includes(biz.id) ? (
                      <FaHeart className="h-4 w-4 sm:h-5 sm:w-5 text-rose-500" />
                    ) : (
                      <FaRegHeart className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                    )}
                  </button>
                </div>

                <div className="p-2.5 sm:p-3.5 flex flex-col flex-grow">
                  {displayCategory ? (
                    <div className={`inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 text-xs font-medium rounded-full mb-1.5 sm:mb-2 w-fit ${catColor}`}>
                      {displayCategory}
                    </div>
                  ) : null}

                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors leading-tight line-clamp-2 mb-1 sm:mb-1.5 text-sm sm:text-base">
                    {biz.business_name}
                  </h3>

                  {biz.description && (
                    <p className="text-xs sm:text-sm text-slate-600 italic leading-relaxed line-clamp-2 mb-1.5 sm:mb-2">
                      {biz.description}
                    </p>
                  )}

                  <p className="text-xs sm:text-sm text-gray-600 line-clamp-1 mt-auto">
                    {locationText}
                  </p>

                  {biz.distance !== undefined && (
                    <div className="mt-2 inline-flex items-center px-2 py-0.5 bg-blue-100/70 text-blue-800 text-xs font-medium rounded-full">
                      ≈ {biz.distance.toFixed(1)} km
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        <div ref={bottomRef} className="mt-8 sm:mt-10 text-center text-xs sm:text-sm text-gray-500">
          {visible.length < filtered.length ? (
            <span className="inline-flex items-center gap-2">
              <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500"></div>
              Loading more...
            </span>
          ) : (
            filtered.length === 0 ? "No matches found" : "End of list"
          )}
        </div>
      </div>
    </div>
  );
}