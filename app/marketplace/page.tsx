'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FaHeart, FaRegHeart } from 'react-icons/fa';

const mockItems = [
  {
    id: 1,
    slug: 'honda-civic-2020',
    title: 'Honda Civic 2020',
    price: 13500,
    location: 'Los Angeles, CA',
    lat: 34.0522,
    lon: -118.2437,
    image: 'https://source.unsplash.com/400x300/?car',
    condition: 'Used',
    category: 'Vehicles',
    date: '2025-04-10',
  },
  {
    id: 2,
    slug: 'iphone-13',
    title: 'iPhone 13',
    price: 700,
    location: 'Dallas, TX',
    lat: 40.7128,
    lon: -74.006,
    image: 'https://source.unsplash.com/400x300/?iphone',
    condition: 'New',
    category: 'Electronics',
    date: '2025-04-12',
  },
  // Add more items...
];

function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function MarketplacePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [tempCoords, setTempCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [radius, setRadius] = useState(50);
  const [tempRadius, setTempRadius] = useState(50);
  const [zipFallback, setZipFallback] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [tempMinPrice, setTempMinPrice] = useState('');
  const [tempMaxPrice, setTempMaxPrice] = useState('');
  const [sort, setSort] = useState('');
  const [tempSort, setTempSort] = useState('');
  const [favorites, setFavorites] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);

  const getUserLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setTempCoords(coords);
      },
      () => alert('Location access denied.')
    );
  };

  const lookupZipOrCity = async () => {
    if (!zipFallback) return;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(zipFallback)}`);
    const data = await res.json();
    if (data.length > 0) {
      const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      setTempCoords(coords);
    } else {
      alert('Could not find that ZIP or City.');
    }
  };

  const clearFilters = () => {
    setTempCoords(null);
    setTempRadius(50);
    setTempMinPrice('');
    setTempMaxPrice('');
    setTempSort('');
    setZipFallback('');
  };

  const applyFilters = () => {
    setUserCoords(tempCoords);
    setRadius(tempRadius);
    setMinPrice(tempMinPrice);
    setMaxPrice(tempMaxPrice);
    setSort(tempSort);
    setShowFilters(false);
  };

  useEffect(() => {
    const saved = localStorage.getItem('userCoords');
    if (saved) {
      setUserCoords(JSON.parse(saved));
      setTempCoords(JSON.parse(saved));
    }
  }, []);

  interface Coordinates {
    lat: number;
    lon: number;
  }

  const toggleFavorite = (id: number): void => {
    setFavorites((prev: number[]) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  let filteredItems = mockItems.filter((item) => {
    const term = searchTerm.toLowerCase().trim();
    return (
      item.title.toLowerCase().includes(term) ||
      item.location.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term)
    );
  });

  if (minPrice) filteredItems = filteredItems.filter((i) => i.price >= parseInt(minPrice));
  if (maxPrice) filteredItems = filteredItems.filter((i) => i.price <= parseInt(maxPrice));

  if (userCoords) {
    filteredItems = filteredItems.filter((i) =>
      getDistanceMiles(userCoords.lat, userCoords.lon, i.lat, i.lon) <= radius
    );
  }

  if (sort === 'priceLow') filteredItems.sort((a, b) => a.price - b.price);
  else if (sort === 'priceHigh') filteredItems.sort((a, b) => b.price - a.price);
  else if (sort === 'newest') filteredItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* 🧱 Title + Toggle */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`text-sm px-3 py-1.5 rounded-md ${
            showFilters ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
          }`}
        >
          {showFilters ? 'Hide Filters' : 'Filters'}
        </button>
      </div>

      {/* 🔍 Search Bar */}
      <input
        type="text"
        placeholder="Search items, phones, cities..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-2 border rounded-md mb-4 text-sm"
      />

      {/* 🧰 Filter Drawer */}
      {showFilters && (
        <div className="bg-gray-50 border rounded-md p-4 mb-6 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={getUserLocation} className="bg-blue-500 text-white text-sm px-3 py-2 rounded-md">
              📍 Detect Location
            </button>
            <input
              type="text"
              placeholder="ZIP or City"
              value={zipFallback}
              onChange={(e) => setZipFallback(e.target.value)}
              onBlur={lookupZipOrCity}
              className="flex-1 p-2 border rounded-md text-sm"
            />
          </div>

          {tempCoords && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Radius: {tempRadius} miles
              </label>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={tempRadius}
                onChange={(e) => setTempRadius(Number(e.target.value))}
                className="w-full"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <input
              type="number"
              placeholder="Min Price"
              value={tempMinPrice}
              onChange={(e) => setTempMinPrice(e.target.value)}
              className="p-2 border rounded-md text-sm"
            />
            <input
              type="number"
              placeholder="Max Price"
              value={tempMaxPrice}
              onChange={(e) => setTempMaxPrice(e.target.value)}
              className="p-2 border rounded-md text-sm"
            />
            <select
              value={tempSort}
              onChange={(e) => setTempSort(e.target.value)}
              className="p-2 border rounded-md text-sm"
            >
              <option value="">Sort by</option>
              <option value="newest">Newest</option>
              <option value="priceLow">Price: Low to High</option>
              <option value="priceHigh">Price: High to Low</option>
            </select>
          </div>

          <div className="flex gap-3 mt-3">
            <button
              onClick={applyFilters}
              className="bg-green-600 text-white px-4 py-2 rounded-md text-sm"
            >
              ✅ Apply Filters
            </button>
            <button
              onClick={clearFilters}
              className="text-red-600 hover:underline text-sm"
            >
              ❌ Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* 🖼️ Item Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {filteredItems.slice(0, visibleCount).map((item) => (
          <div key={item.id} className="relative group">
            <Link
              href={`/marketplace/${item.slug}`}
              className="block border rounded-xl overflow-hidden shadow hover:shadow-lg transition bg-white"
            >
              <Image
                src={item.image}
                alt={item.title}
                width={400}
                height={300}
                className="w-full h-48 object-cover"
              />
              <div className="p-3 space-y-1">
                <h3 className="font-semibold text-lg">{item.title}</h3>
                <p className="text-green-600 font-medium">${item.price}</p>
                <p className="text-sm text-gray-500">{item.location}</p>
                <span className={`text-xs inline-block mt-1 px-2 py-1 rounded-full ${
                  item.condition === 'New'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {item.condition}
                </span>
              </div>
            </Link>
            <button
              onClick={() => toggleFavorite(item.id)}
              className="absolute top-3 right-3 text-white bg-black/40 rounded-full p-1 hover:bg-black/60"
            >
              {favorites.includes(item.id) ? (
                <FaHeart className="text-red-500" />
              ) : (
                <FaRegHeart className="text-white" />
              )}
            </button>
          </div>
        ))}
      </div>

      {/* ❌ No Results */}
      {filteredItems.length === 0 && (
        <p className="text-center text-gray-500 mt-6">
          😔 No results found. Try changing your search or filters.
        </p>
      )}

      {/* 🔽 Show More */}
      {filteredItems.length > visibleCount && (
        <div className="text-center mt-6">
          <button
            onClick={() => setVisibleCount(visibleCount + 6)}
            className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 transition"
          >
            Show More
          </button>
        </div>
      )}
    </div>
  );
}
