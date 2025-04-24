'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaHeart, FaRegHeart } from 'react-icons/fa';

interface Item {
  id: string;
  slug: string;
  title: string;
  price: number;
  location: string;
  lat: number;
  lon: number;
  image: string;
  condition: 'New' | 'Used';
  category: string;
  date: string;
}

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

export default function MarketplacePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [radius, setRadius] = useState(50);
  const [visibleCount, setVisibleCount] = useState(6);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('userCoords');
    if (stored) setUserCoords(JSON.parse(stored));

    fetch('http://localhost:5000/api/marketplace/list')
      .then((res) => res.json())
      .then((data) => setItems(data.items || []));
  }, []);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  let filteredItems = items.filter((item) =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (userCoords) {
    filteredItems = filteredItems.filter((item) =>
      getDistanceMiles(userCoords.lat, userCoords.lon, item.lat, item.lon) <= radius
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Marketplace</h1>
      </div>

      <input
        type="text"
        placeholder="Search items..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-2 border rounded-md mb-4"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {filteredItems.slice(0, visibleCount).map((item) => (
          <div
            key={item.id}
            className="relative group border rounded-xl shadow hover:shadow-lg bg-white overflow-hidden"
          >
            <Link href={`/marketplace/${item.slug}`}>
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
                <span
                  className={`text-xs inline-block mt-1 px-2 py-1 rounded-full ${
                    item.condition === 'New'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
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

      {filteredItems.length === 0 && (
        <p className="text-center text-gray-500 mt-6">
          😔 No items found near your location. Try changing search or distance.
        </p>
      )}

      {filteredItems.length > visibleCount && (
        <div className="text-center mt-6">
          <button
            onClick={() => setVisibleCount(visibleCount + 6)}
            className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600"
          >
            Show More
          </button>
        </div>
      )}
    </div>
  );
}
