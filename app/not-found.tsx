'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/businesses?search=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16 text-center bg-cover bg-center"
      style={{ backgroundImage: `url(https://source.unsplash.com/1600x900/?bazaar,middleeast)` }}
    >
      <div className="bg-white/80 backdrop-blur p-6 rounded-xl shadow-md max-w-lg w-full">
        <h1 className="text-5xl font-bold text-rose-700 mb-4">404</h1>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Page Not Found
        </h2>
        <p className="text-gray-600 mb-4">
          🧭 Your <span className="font-semibold">bolani cart</span> took a wrong turn...
        </p>

        {/* 🔍 Search bar */}
        <form onSubmit={handleSearch} className="flex items-center gap-2 mb-4">
          <input
            type="text"
            placeholder="Search businesses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
          >
            Search
          </button>
        </form>

        <Link
          href="/"
          className="inline-block mt-2 text-sm text-blue-600 hover:underline"
        >
          ← Back to Hanar Home
        </Link>
      </div>
    </div>
  );
}
