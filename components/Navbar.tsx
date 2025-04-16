// components/Navbar.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FaMapMarkerAlt, FaUser, FaBell } from 'react-icons/fa';

export default function Navbar() {
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const coords = localStorage.getItem('userCoords');
    if (coords) {
      const { lat, lon } = JSON.parse(coords);
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
        .then((res) => res.json())
        .then((data) => {
          const city =
            data.address.city ||
            data.address.town ||
            data.address.village ||
            data.address.state ||
            data.display_name;
          setLocationLabel(city);
        })
        .catch(() => setLocationLabel(null));
    }
  }, []);

  const resetLocation = () => {
    localStorage.removeItem('hasSeenLocationPrompt');
    localStorage.removeItem('userCoords');
    location.reload();
  };

  return (
    <nav className="bg-white h-14 flex items-center justify-between px-4 sticky top-0 z-50 transition-all relative shadow-sm border-b border-gray-200">
      {/* 📍 Location (left) */}
      <button
        onClick={resetLocation}
        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition max-w-[130px]"
      >
        <FaMapMarkerAlt size={18} />
        <span className="truncate">{locationLabel || 'Set Location'}</span>
      </button>

      {/* 🟡 Centered Logo */}
      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <Link href="/">
          <img
            src="/logo.gif"
            alt="Hanar Logo"
            className="h-10 w-auto"
          />
        </Link>
      </div>

      {/* 👤 Dashboard + 🔔 Notifications + ☰ Menu (right) */}
      <div className="flex items-center gap-4 sm:gap-6">
        <Link href="/dashboard">
          <FaUser className="text-purple-600 text-lg hover:text-purple-800 transition cursor-pointer" />
        </Link>

        <Link href="/notifications">
          <div className="relative group">
            <FaBell className="text-blue-600 text-lg group-hover:animate-wiggle transition cursor-pointer" />
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full shadow-sm">
              3
            </span>
          </div>
        </Link>

        {/* ☰ Menu Toggle (optional) */}
        <button
          onClick={() => setMenuOpen(true)}
          className="text-rose-600 hover:text-rose-800 transition text-xl sm:hidden"
        >
          ☰
        </button>
      </div>
    </nav>
  );
}
