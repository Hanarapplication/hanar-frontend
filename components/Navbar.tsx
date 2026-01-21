'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FaMapMarkerAlt, FaBell, FaBars } from 'react-icons/fa';
import { usePathname } from 'next/navigation';
import MobileMenu from './MobileMenu';

export default function Navbar() {
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const coords = localStorage.getItem('userCoords');
    if (coords) {
      const { lat, lon } = JSON.parse(coords);
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
        .then((res) => res.json())
        .then((data) => {
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.state ||
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
    <>
      <nav className="bg-white h-16 flex items-center justify-between px-4 sticky top-0 z-50 transition-all relative border-b border-gray-100">
        {/* Logo */}
        <div className="flex items-center">
          <Link href="/" className="focus:outline-none">
            <img
              src="/hanar.logo.png"
              alt="Hanar Logo"
              width={100}
  height={100}
              className="h-10 w-auto transition-transform transform hover:scale-105 focus:scale-105"
            />
          </Link>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-6 sm:gap-8">
          {/* Location */}
          <button
            onClick={resetLocation}
            className="group flex items-center gap-1 text-sm text-gray-600 hover:text-blue-700 focus:outline-none transition-colors duration-200 max-w-[140px]"
          >
            <FaMapMarkerAlt size={16} className="text-blue-500 group-hover:text-blue-700" />
            <span className="truncate">{locationLabel || 'Set Location'}</span>
          </button>

          {/* Notifications */}
          <Link href="/notifications" className="relative focus:outline-none">
            <div className="relative group">
              <FaBell className="text-gray-600 text-xl group-hover:text-blue-700 transition-colors duration-200 cursor-pointer" />
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full shadow-sm">
                3
              </span>
            </div>
          </Link>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-gray-600 hover:text-rose-700 transition-colors duration-200 text-2xl focus:outline-none"
            aria-label="Toggle Menu"
          >
            <FaBars />
          </button>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      <MobileMenu isOpen={menuOpen} setIsOpen={setMenuOpen} />
    </>
  );
}
