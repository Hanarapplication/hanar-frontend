'use client';

import Link from 'next/link';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import { FaMapMarkerAlt, FaBell, FaBars, FaSearch, FaCheck } from 'react-icons/fa';
import { usePathname } from 'next/navigation';
import MobileMenu from './MobileMenu';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

type CityResult = { label: string; lat: number; lng: number };

type SearchResultItem = {
  type: 'user' | 'business' | 'organization';
  label: string;
  subtitle: string | null;
  imageUrl: string | null;
  href: string;
};

export default function Navbar() {
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationRequired, setLocationRequired] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<CityResult[]>([]);
  const [locationSearchLoading, setLocationSearchLoading] = useState(false);
  const [locationRequesting, setLocationRequesting] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const locationSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationModalRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { effectiveLang } = useLanguage();

  // Debounced search — short delay so it feels letter-by-letter; ignore stale responses
  const searchRequestIdRef = useRef(0);
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setSearchLoading(true);
    const requestId = ++searchRequestIdRef.current;
    searchTimeoutRef.current = setTimeout(() => {
      searchTimeoutRef.current = null;
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data) => {
          // Only apply results if this is still the latest request (avoids stale results when typing fast)
          if (requestId !== searchRequestIdRef.current) return;
          if (data.results) setSearchResults(data.results);
          else setSearchResults([]);
        })
        .catch(() => {
          if (requestId !== searchRequestIdRef.current) return;
          setSearchResults([]);
        })
        .finally(() => {
          if (requestId === searchRequestIdRef.current) setSearchLoading(false);
        });
    }, 100);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSelect = useCallback(
    (href: string) => {
      setSearchQuery('');
      setSearchResults([]);
      setSearchOpen(false);
      router.push(href);
    },
    [router]
  );

  // Close search dropdown when route changes
  useEffect(() => {
    setSearchOpen(false);
  }, [pathname]);

  const persistLocation = useCallback(async (
    lat: number,
    lon: number,
    meta?: { city?: string | null; state?: string | null; zip?: string | null; source?: string }
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || '';
      await fetch('/api/user-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          lat,
          lng: lon,
          city: meta?.city ?? null,
          state: meta?.state ?? null,
          zip: meta?.zip ?? null,
          source: meta?.source ?? null,
        }),
      });
    } catch {
      // Ignore
    }
  }, []);

  const applyLocation = useCallback((lat: number, lon: number, label: string | null, meta?: { city?: string | null; state?: string | null; zip?: string | null; source?: string }) => {
    localStorage.setItem('userCoords', JSON.stringify({ lat, lon }));
    if (label) {
      localStorage.setItem('userLocationLabel', label);
      setLocationLabel(label);
    }
    persistLocation(lat, lon, meta);
    window.dispatchEvent(new CustomEvent('location:updated', { detail: { lat, lon, label, ...meta } }));
  }, [persistLocation]);

  const fetchLabelFromCoords = useCallback((lat: number, lon: number) => {
    fetch(`/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`)
      .then((res) => res.json())
      .then((data) => {
        const city =
          data.address?.city ||
          data.address?.town ||
          data.address?.village ||
          data.address?.state ||
          data.display_name;
        if (city) {
          localStorage.setItem('userLocationLabel', city);
          setLocationLabel(city);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const storedLabel = typeof localStorage !== 'undefined' ? localStorage.getItem('userLocationLabel') : null;
    const storedCoords = typeof localStorage !== 'undefined' ? localStorage.getItem('userCoords') : null;
    if (storedLabel) {
      setLocationLabel(storedLabel);
    } else if (storedCoords) {
      try {
        const { lat, lon } = JSON.parse(storedCoords);
        if (typeof lat === 'number' && typeof lon === 'number') fetchLabelFromCoords(lat, lon);
      } catch {}
    } else {
      setLocationModalOpen(true);
      setLocationRequired(true);
    }
  }, [fetchLabelFromCoords]);

  useEffect(() => {
    const handleLocationUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail as { lat?: number; lon?: number; label?: string; city?: string | null; state?: string | null; zip?: string | null; source?: string } | undefined;
      if (detail?.lat != null && detail?.lon != null) {
        setLocationLabel(detail.label ?? null);
        if (detail.label) localStorage.setItem('userLocationLabel', detail.label);
      }
    };
    window.addEventListener('location:updated', handleLocationUpdated as EventListener);
    return () => window.removeEventListener('location:updated', handleLocationUpdated as EventListener);
  }, []);

  useEffect(() => {
    const syncStoredLocationIfLoggedIn = async () => {
      const coordsRaw = localStorage.getItem('userCoords');
      if (!coordsRaw) return;
      try {
        const { lat, lon } = JSON.parse(coordsRaw);
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) persistLocation(lat, lon, { source: 'gps' });
      } catch {}
    };
    syncStoredLocationIfLoggedIn();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => { syncStoredLocationIfLoggedIn(); });
    return () => authListener?.subscription?.unsubscribe();
  }, [persistLocation]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locationRequired) setLocationModalOpen(false);
    };
    if (locationModalOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [locationModalOpen, locationRequired]);

  useEffect(() => {
    const q = locationSearchQuery.trim();
    if (q.length < 2) {
      setLocationSearchResults([]);
      return;
    }
    if (locationSearchTimeoutRef.current) clearTimeout(locationSearchTimeoutRef.current);
    setLocationSearchLoading(true);
    locationSearchTimeoutRef.current = setTimeout(() => {
      locationSearchTimeoutRef.current = null;
      fetch(`/api/geocode/cities?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data) => {
          setLocationSearchResults(Array.isArray(data.results) ? data.results : []);
        })
        .catch(() => setLocationSearchResults([]))
        .finally(() => setLocationSearchLoading(false));
    }, 280);
    return () => {
      if (locationSearchTimeoutRef.current) clearTimeout(locationSearchTimeoutRef.current);
    };
  }, [locationSearchQuery]);

  useEffect(() => {
    const loadUnreadCount = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUnreadCount(0);
        return;
      }

      const { data: businesses, error: businessError } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id);
      if (businessError) {
        setUnreadCount(0);
        return;
      }
      const ownedIds = new Set((businesses || []).map((row) => String((row as any).id)));

      const { data, error } = await supabase
        .from('notifications')
        .select('id, data')
        .eq('user_id', user.id)
        .is('read_at', null);

      if (error) {
        setUnreadCount(0);
        return;
      }

      const rows = (data || []) as Array<{ id: string; data?: { business_id?: string } }>;
      const visible = rows.filter((row) => {
        const businessId = row.data?.business_id;
        if (businessId && ownedIds.has(String(businessId))) return false;
        return true;
      });
      setUnreadCount(visible.length);
    };

    loadUnreadCount();
    const handler = () => loadUnreadCount();
    window.addEventListener('notifications:updated', handler);
    return () => window.removeEventListener('notifications:updated', handler);
  }, []);

  const useMyLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError(t(effectiveLang, 'Location is not supported by your browser'));
      return;
    }
    setLocationError(null);
    setLocationRequesting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          localStorage.setItem('userCoords', JSON.stringify({ lat, lon }));
          persistLocation(lat, lon, { source: 'gps' });
          window.dispatchEvent(new CustomEvent('location:updated', { detail: { lat, lon } }));
        } catch (_) {}
        fetchLabelFromCoords(lat, lon);
        setLocationRequesting(false);
        setLocationModalOpen(false);
        setLocationRequired(false);
      },
      () => {
        setLocationRequesting(false);
        setLocationError(t(effectiveLang, 'Could not get location. Please allow access or search for a city.'));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, [effectiveLang, persistLocation, fetchLabelFromCoords]);

  const chooseCity = useCallback((city: CityResult) => {
    applyLocation(city.lat, city.lng, city.label, { source: 'search' });
    setLocationSearchQuery('');
    setLocationSearchResults([]);
    setLocationModalOpen(false);
    setLocationRequired(false);
  }, [applyLocation]);

  const openLocationModal = () => {
    setLocationError(null);
    setLocationSearchQuery('');
    setLocationSearchResults([]);
    setLocationRequired(!locationLabel);
    setLocationModalOpen(true);
  };

  return (
    <>
      <nav className="bg-blue-600 dark:bg-blue-800 h-16 flex items-center justify-between px-4 sticky top-0 z-50 transition-all relative border-b border-blue-500 dark:border-blue-700">
        {/* Logo */}
        <div className="flex items-center shrink-0">
          <Link href="/" className="focus:outline-none block">
            <Image
              src="/hanar.logo.png"
              alt="Hanar Logo"
              width={100}
              height={40}
              className="h-10 w-auto object-contain transition-transform transform hover:scale-105 focus:scale-105"
              unoptimized
              priority
            />
          </Link>
        </div>

        {/* Search bar - Facebook style */}
        <div className="flex-1 max-w-md mx-2 sm:mx-4 relative" ref={dropdownRef}>
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-200 text-sm pointer-events-none" />
            <input
              type="search"
              placeholder={t(effectiveLang, 'Search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              className="w-full h-9 pl-9 pr-3 rounded-full bg-blue-500/50 dark:bg-blue-900/40 border border-blue-400/50 dark:border-blue-600/50 text-white placeholder-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
              aria-label="Search"
            />
          </div>
          {searchOpen && (searchQuery.trim().length >= 1 || searchResults.length > 0) && (
            <div className="absolute top-full left-0 mt-1.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-[100] max-h-[70vh] overflow-y-auto w-[min(100vw-2rem,440px)] min-w-[280px]">
              {searchLoading ? (
                <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-base">
                  {t(effectiveLang, 'Searching…')}
                </div>
              ) : searchQuery.trim().length >= 1 && searchResults.length === 0 ? (
                <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-base">
                  {t(effectiveLang, 'No results found')}
                </div>
              ) : (
                <ul className="py-2">
                  {searchResults.map((item, idx) => (
                    <li key={`${item.type}-${item.href}-${idx}`}>
                      <button
                        type="button"
                        onClick={() => handleSearchSelect(item.href)}
                        className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors"
                      >
                        <span className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center shrink-0 overflow-hidden">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400 text-xl font-medium">
                              {item.label.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <div className="flex-1 min-w-0 text-left overflow-hidden">
                          <div className="font-semibold text-slate-800 dark:text-slate-200 text-base break-words">
                            {item.label}
                          </div>
                          {item.subtitle && (
                            <div className="text-sm text-slate-500 dark:text-slate-400 break-words mt-0.5">
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-6 sm:gap-8">
          {/* Location: click opens popup to set/change location */}
          <button
            type="button"
            onClick={openLocationModal}
            className="group flex items-center gap-1.5 text-sm text-blue-100 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50 rounded-lg px-2 py-1.5 transition-colors duration-200 max-w-[160px]"
            aria-label={locationLabel ? t(effectiveLang, 'Change location') : t(effectiveLang, 'Set location')}
          >
            <FaMapMarkerAlt size={14} className="text-blue-200 group-hover:text-white shrink-0" />
            <span className="truncate">
              {locationLabel ? (
                <span className="flex items-center gap-1.5">
                  <span className="truncate">{locationLabel}</span>
                  <FaCheck className="text-emerald-300 shrink-0 w-3 h-3" aria-hidden />
                </span>
              ) : (
                t(effectiveLang, 'Set location')
              )}
            </span>
          </button>

          {/* Location popup modal — portaled to body so it receives clicks and is on top */}
          {locationModalOpen && typeof document !== 'undefined' && createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                if (!locationRequired && e.target === e.currentTarget) setLocationModalOpen(false);
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="location-modal-title"
            >
              <div
                ref={locationModalRef}
                className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
              >
                <div className="p-6">
                  <h2 id="location-modal-title" className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                    {t(effectiveLang, 'Set your location')}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
                    {t(effectiveLang, 'We’ll use this to show you nearby content and relevant banners.')}
                  </p>
                  <button
                    type="button"
                    onClick={useMyLocation}
                    disabled={locationRequesting}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500 disabled:cursor-wait text-white font-medium text-base transition-colors"
                  >
                    <FaMapMarkerAlt className="text-lg shrink-0" />
                    {locationRequesting ? t(effectiveLang, 'Getting location…') : t(effectiveLang, 'Use my location')}
                  </button>
                  {locationError && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">{locationError}</p>
                  )}
                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                    {t(effectiveLang, 'Or search for a city')}
                  </p>
                  <input
                    type="text"
                    value={locationSearchQuery}
                    onChange={(e) => setLocationSearchQuery(e.target.value)}
                    placeholder="e.g. Los Angeles, New York"
                    className="mt-2 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {locationSearchLoading && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t(effectiveLang, 'Searching…')}</p>
                  )}
                  {locationSearchResults.length > 0 && (
                    <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 divide-y divide-slate-100 dark:divide-slate-700">
                      {locationSearchResults.map((city, idx) => (
                        <li key={`${city.label}-${idx}`}>
                          <button
                            type="button"
                            onClick={() => chooseCity(city)}
                            className="w-full text-left px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors"
                          >
                            {city.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {!locationRequired && (
                  <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setLocationModalOpen(false)}
                      className="w-full py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      {t(effectiveLang, 'Cancel')}
                    </button>
                  </div>
                )}
              </div>
            </div>,
            document.body
          )}

          {/* Notifications */}
          <Link href="/notifications" className="relative focus:outline-none">
            <div className="relative group">
              <FaBell className="text-blue-100 text-xl group-hover:text-white transition-colors duration-200 cursor-pointer" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full shadow-sm">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          </Link>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-blue-100 hover:text-white transition-colors duration-200 text-2xl focus:outline-none"
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
