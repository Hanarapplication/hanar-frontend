'use client';

import { useEffect, useState } from 'react';

const mockBusinesses = [
  {
    id: 1,
    name: 'Taste of Beirut',
    category: 'Restaurant',
    location: 'Los Angeles, CA',
    image: 'https://source.unsplash.com/400x300/?restaurant,beirut',
  },
  {
    id: 2,
    name: 'Halal Market',
    category: 'Grocery Store',
    location: 'Dearborn, MI',
    image: 'https://source.unsplash.com/400x300/?grocery,market',
  },
  {
    id: 3,
    name: 'Sahara Salon',
    category: 'Hair & Beauty',
    location: 'New York, NY',
    image: 'https://source.unsplash.com/400x300/?salon,beauty',
  },
  {
    id: 4,
    name: 'Middle East Auto',
    category: 'Auto Repair',
    location: 'Chicago, IL',
    image: 'https://source.unsplash.com/400x300/?auto,garage',
  },
];

export default function BusinessesPage() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Business Listings</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {mockBusinesses.map((biz, i) => (
          <div
            key={biz.id}
            className={`bg-white rounded-xl overflow-hidden shadow-md transform transition duration-500 ease-out ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
            }`}
            style={{ transitionDelay: `${i * 100}ms` }}
          >
            <img src={biz.image} alt={biz.name} className="w-full h-48 object-cover" />
            <div className="p-5">
              <div className="inline-block bg-indigo-100 text-indigo-700 text-sm font-semibold px-3 py-1 rounded-full mb-3 shadow-sm">
                {biz.name}
              </div>
              <p className="text-gray-700 text-sm">{biz.category}</p>
              <p className="text-gray-400 text-xs">{biz.location}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
