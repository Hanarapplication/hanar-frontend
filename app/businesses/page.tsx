'use client';

import { useEffect, useState, useRef } from 'react';
import { FaSearch, FaStar } from 'react-icons/fa';

interface Business {
  id: number;
  name: string;
  category: string;
  location: string;
  lat: number;
  lon: number;
  image: string;
  distance?: number;
}

const mockBusinesses: Business[] = [
  { id: 1, name: 'Taste of Beirut', category: 'Restaurant', location: 'Los Angeles, CA', lat: 34.0522, lon: -118.2437, image: 'https://source.unsplash.com/400x300/?restaurant,beirut' },
  { id: 2, name: 'Halal Market', category: 'Grocery Store', location: 'Dearborn, MI', lat: 42.3223, lon: -83.1763, image: 'https://source.unsplash.com/400x300/?grocery,market' },
  { id: 3, name: 'Sahara Salon', category: 'Hair & Beauty', location: 'New York, NY', lat: 40.7128, lon: -74.0060, image: 'https://source.unsplash.com/400x300/?salon,beauty' },
  { id: 4, name: 'Middle East Auto', category: 'Auto Repair', location: 'Chicago, IL', lat: 41.8781, lon: -87.6298, image: 'https://source.unsplash.com/400x300/?auto,garage' },
  { id: 5, name: 'Casablanca Cafe', category: 'Cafe', location: 'San Diego, CA', lat: 32.7157, lon: -117.1611, image: 'https://source.unsplash.com/400x300/?cafe,morocco' },
  { id: 6, name: 'Petra Boutique', category: 'Clothing', location: 'Houston, TX', lat: 29.7604, lon: -95.3698, image: 'https://source.unsplash.com/400x300/?clothing,boutique' },
  { id: 7, name: 'Damascus Bakery', category: 'Bakery', location: 'Brooklyn, NY', lat: 40.6782, lon: -73.9442, image: 'https://source.unsplash.com/400x300/?bakery,arabic' },
  { id: 8, name: 'Shawarma Spot', category: 'Restaurant', location: 'Atlanta, GA', lat: 33.7490, lon: -84.3880, image: 'https://source.unsplash.com/400x300/?shawarma,food' },
  { id: 9, name: 'Desert Treasures', category: 'Gift Shop', location: 'Phoenix, AZ', lat: 33.4484, lon: -112.0740, image: 'https://source.unsplash.com/400x300/?gifts,market' },
  { id: 10, name: 'Golden Falafel', category: 'Restaurant', location: 'Seattle, WA', lat: 47.6062, lon: -122.3321, image: 'https://source.unsplash.com/400x300/?falafel,food' }
];

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
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
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'nearest' | 'default'>('default');
  const [userLocation, setUserLocation] = useState<{ lat: number, lon: number } | null>(null);
  const [visibleCount, setVisibleCount] = useState(6);
  const bottomRef = useRef(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        setUserLocation(coords);
        const updated = mockBusinesses.map(biz => ({
          ...biz,
          distance: getDistanceFromLatLonInKm(coords.lat, coords.lon, biz.lat, biz.lon)
        }));
        setBusinesses(updated);
      },
      () => {
        setBusinesses(mockBusinesses); // fallback
      }
    );
  }, []);

  const filtered = businesses
    .filter(b =>
      b.name.toLowerCase().includes(query.toLowerCase()) ||
      b.category.toLowerCase().includes(query.toLowerCase()) ||
      b.location.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => {
      if (filter === 'nearest') {
        return (a.distance || 99999) - (b.distance || 99999);
      }
      return a.name.localeCompare(b.name);
    });

  const visible = filtered.slice(0, visibleCount);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + 6);
        }
      },
      { threshold: 1 }
    );
    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [filtered]);

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="sticky top-16 z-10 bg-white py-4">
        <div className="flex items-center gap-2">
          <FaSearch className="text-gray-500" />
          <input
            type="text"
            placeholder="Search businesses..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full p-2 border rounded shadow-sm text-sm"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'default' | 'nearest')}
            className="p-2 text-sm border rounded"
          >
            <option value="default">Sort A-Z</option>
            <option value="nearest">Nearest</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
        {visible.map((biz) => (
          <div key={biz.id} className="bg-white rounded-xl shadow hover:shadow-lg overflow-hidden transition-all duration-300">
            <img src={biz.image} className="h-40 w-full object-cover" alt={biz.name} />
            <div className="p-4 space-y-2">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800">{biz.name}</h2>
                <FaStar className="text-yellow-500" />
              </div>
              <p className="text-sm text-gray-600">{biz.category}</p>
              <p className="text-xs text-gray-400">{biz.location}</p>
              {filter === 'nearest' && userLocation && (
                <p className="text-xs text-indigo-500 font-semibold">
                  {biz.distance?.toFixed(1)} km away
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div ref={bottomRef} className="text-center text-sm text-gray-400 py-6">
        {visible.length < filtered.length ? 'Loading more...' : 'No more businesses'}
      </div>
    </div>
  );
}
