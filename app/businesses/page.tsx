'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { FaSearch, FaHeart, FaRegHeart } from 'react-icons/fa';
import { supabase } from '@/lib/supabaseClient';

interface Business {
  id: number;
  business_name: string;
  category: string;
  address: any;
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
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'nearest' | 'default'>('default');
  const [userLocation, setUserLocation] = useState<{ lat: number, lon: number } | null>(null);
  const [visibleCount, setVisibleCount] = useState(6);
  const bottomRef = useRef(null);

  useEffect(() => {
    async function fetchBusinesses() {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, business_name, category, address, logo_url, slug, lat, lon')
        .eq('business_status', 'approved')
        .eq('status', 'active');

      if (error) {
        console.error('Supabase fetch error:', error);
        return;
      }

      setBusinesses(data || []);
    }

    fetchBusinesses();
    const savedFavorites = JSON.parse(localStorage.getItem('favoriteBusinesses') || '[]');
    setFavorites(savedFavorites);
  }, []);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        setUserLocation(coords);

        setBusinesses((prev) =>
          prev.map((biz) => ({
            ...biz,
            distance: (biz.lat && biz.lon) ? getDistanceFromLatLonInKm(coords.lat, coords.lon, biz.lat, biz.lon) : undefined,
          }))
        );
      },
      (error) => {
        console.warn('Location fetch failed', error);
      }
    );
  }, []);

  const toggleFavorite = (slug: string) => {
    let updatedFavorites = [...favorites];
    if (updatedFavorites.includes(slug)) {
      updatedFavorites = updatedFavorites.filter((fav) => fav !== slug);
    } else {
      updatedFavorites.push(slug);
    }
    setFavorites(updatedFavorites);
    localStorage.setItem('favoriteBusinesses', JSON.stringify(updatedFavorites));
  };

  const filtered = businesses
    .filter((b) =>
      b.business_name.toLowerCase().includes(query.toLowerCase()) ||
      b.category.toLowerCase().includes(query.toLowerCase()) ||
      (typeof b.address === 'string'
        ? b.address.toLowerCase().includes(query.toLowerCase())
        : Object.values(b.address || {}).join(' ').toLowerCase().includes(query.toLowerCase()))
    )
    .sort((a, b) => {
      if (filter === 'nearest' && a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      return a.business_name.localeCompare(b.business_name);
    });

  const visible = filtered.slice(0, visibleCount);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 6);
        }
      },
      { threshold: 1 }
    );
    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [filtered]);

  return (
    <div className="max-w-5xl mx-auto p-4 bg-gray-50 min-h-screen">
      {/* Search & Filter */}
      <div className="sticky top-0 bg-gray-50 py-3 z-10">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="flex items-center bg-white rounded-md p-2 w-full sm:w-auto border focus-within:ring-2 focus-within:ring-indigo-500">
            <FaSearch className="text-gray-500 mr-2" />
            <input
              type="text"
              placeholder="Search businesses..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full text-sm bg-transparent focus:outline-none py-2"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'default' | 'nearest')}
            className="p-2 text-sm border rounded w-full sm:w-auto"
          >
            <option value="default">Sort A-Z</option>
            <option value="nearest">Nearest</option>
          </select>
        </div>
      </div>

      {/* Business Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
        {visible.map((biz) => (
          <Link
            key={biz.id}
            href={`/business/${biz.slug}`}
            className="block bg-white rounded-xl shadow hover:shadow-lg overflow-hidden transition-all duration-200"
          >
            <div className="relative">
              <img
                src={biz.logo_url || 'https://source.unsplash.com/400x300/?business'}
                className="h-40 w-full object-cover rounded-t-xl"
                alt={biz.business_name}
              />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  toggleFavorite(biz.slug);
                }}
                className="absolute top-2 right-2 bg-white p-1 rounded-full shadow z-10"
              >
                {favorites.includes(biz.slug) ? (
                  <FaHeart className="text-red-500" size={20} />
                ) : (
                  <FaRegHeart className="text-gray-400" size={20} />
                )}
              </button>
            </div>
            <div className="p-3 space-y-1">
              <h2 className="text-lg font-semibold text-gray-800">{biz.business_name}</h2>
              <p className="text-sm text-gray-600">{biz.category}</p>
              <p className="text-xs text-gray-400">
                {typeof biz.address === 'string'
                  ? biz.address
                  : Object.values(biz.address || {}).filter(Boolean).join(', ')}
              </p>
              {filter === 'nearest' && userLocation && biz.distance !== undefined && (
                <p className="text-xs text-indigo-500 font-semibold">
                  {biz.distance.toFixed(1)} km away
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Infinite Scroll Trigger */}
      <div ref={bottomRef} className="text-center text-sm text-gray-400 py-6">
        {visible.length < filtered.length ? 'Loading more businesses...' : 'No more businesses'}
      </div>
    </div>
  );
}
