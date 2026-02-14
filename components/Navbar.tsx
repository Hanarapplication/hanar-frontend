'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import { FaMapMarkerAlt, FaBell, FaBars, FaSearch } from 'react-icons/fa';
import { usePathname } from 'next/navigation';
import MobileMenu from './MobileMenu';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

type SearchResultItem = {
  type: 'user' | 'business' | 'organization';
  label: string;
  subtitle: string | null;
  imageUrl: string | null;
  href: string;
};

export default function Navbar() {
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
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

  useEffect(() => {
    const persistLocation = async (
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
        // Ignore location persistence failures
      }
    };

    const setLocationFromCoords = (
      lat: number,
      lon: number,
      label?: string | null,
      meta?: { city?: string | null; state?: string | null; zip?: string | null; source?: string }
    ) => {
      localStorage.setItem('userCoords', JSON.stringify({ lat, lon }));
      persistLocation(lat, lon, meta);
      if (label) {
        setLocationLabel(label);
        try { localStorage.setItem('userLocationLabel', label); } catch {}
        return;
      }
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
          try { if (city) localStorage.setItem('userLocationLabel', city); } catch {}
        })
        .catch(() => setLocationLabel(null));
    };

    const detectLocation = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocationFromCoords(pos.coords.latitude, pos.coords.longitude),
        () => setLocationLabel(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };

    const coords = localStorage.getItem('userCoords');
    if (coords) {
      const { lat, lon } = JSON.parse(coords);
      setLocationFromCoords(lat, lon);
    } else {
      detectLocation();
    }

    const syncStoredLocationIfLoggedIn = async () => {
      const coordsRaw = localStorage.getItem('userCoords');
      if (!coordsRaw) return;
      const { lat, lon } = JSON.parse(coordsRaw);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        persistLocation(lat, lon, { source: 'gps' });
      }
    };

    syncStoredLocationIfLoggedIn();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      syncStoredLocationIfLoggedIn();
    });

    const handleLocationUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | {
            lat: number;
            lon: number;
            label?: string;
            city?: string | null;
            state?: string | null;
            zip?: string | null;
            source?: string;
          }
        | undefined;
      if (detail?.lat && detail?.lon) {
        setLocationFromCoords(detail.lat, detail.lon, detail.label, {
          city: detail.city ?? undefined,
          state: detail.state ?? undefined,
          zip: detail.zip ?? undefined,
          source: detail.source ?? undefined,
        });
        return;
      }
      const stored = localStorage.getItem('userCoords');
      if (stored) {
        const { lat, lon } = JSON.parse(stored);
        setLocationFromCoords(lat, lon);
      }
    };

    window.addEventListener('location:updated', handleLocationUpdated as EventListener);
    return () => {
      window.removeEventListener('location:updated', handleLocationUpdated as EventListener);
      authListener?.subscription?.unsubscribe();
    };
  }, []);

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

  const resetLocation = () => {
    localStorage.removeItem('hasSeenLocationPrompt');
    localStorage.removeItem('userCoords');
    localStorage.removeItem('userLocationLabel');
    setLocationLabel(null);
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        localStorage.setItem('userCoords', JSON.stringify({ lat, lon }));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('location:updated', { detail: { lat, lon, source: 'gps' } }));
        }
        supabase.auth.getSession().then(({ data: { session } }) => {
          const accessToken = session?.access_token || '';
          fetch('/api/user-location', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify({ lat, lng: lon, source: 'gps' }),
          }).catch(() => {});
        });
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
      },
      () => setLocationLabel(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
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
          {/* Location */}
          <button
            onClick={resetLocation}
            className="group flex items-center gap-1 text-sm text-blue-100 hover:text-white focus:outline-none transition-colors duration-200 max-w-[140px]"
          >
            <FaMapMarkerAlt size={16} className="text-blue-200 group-hover:text-white" />
            <span className="truncate">{locationLabel || t(effectiveLang, 'Set Location')}</span>
          </button>

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
