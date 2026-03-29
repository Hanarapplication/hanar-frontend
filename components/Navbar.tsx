'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import { FaBell, FaBars, FaComments, FaSearch } from 'react-icons/fa';
import { usePathname } from 'next/navigation';
import MobileMenu from './MobileMenu';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';
import { writeSavedSearchRadiusMiles } from '@/lib/geoDistance';

const HEADER_SEARCH_BORDER =
  'border border-amber-400 dark:border-amber-500/90 focus:ring-2 focus:ring-amber-300/80 dark:focus:ring-amber-400/60 focus:border-amber-500 dark:focus:border-amber-400';

type SearchResultItem = {
  type: 'user' | 'business' | 'organization';
  label: string;
  subtitle: string | null;
  imageUrl: string | null;
  href: string;
};

export default function Navbar() {
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

  /** Keep shared location prefs in sync when Set on Businesses/Marketplace/Location prompt (no header UI). */
  useEffect(() => {
    const handleLocationUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail as { label?: string; radiusMiles?: number } | undefined;
      if (detail?.label) localStorage.setItem('userLocationLabel', detail.label);
      if (detail?.radiusMiles != null) writeSavedSearchRadiusMiles(detail.radiusMiles);
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

  return (
    <>
      <nav className="bg-white dark:bg-slate-900 h-[3.75rem] sm:h-16 flex items-center justify-between gap-2 px-3 sticky top-0 z-50 transition-all relative border-b border-slate-200 dark:border-slate-800">
        {/* Messages + search */}
        <div className="flex flex-1 max-w-md mx-1.5 sm:mx-3 items-center gap-2 sm:gap-2.5 min-w-0">
          <Link
            href="/messages"
            className="shrink-0 rounded-full p-1.5 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/55 dark:focus-visible:ring-rose-500/45"
            aria-label="Messages"
          >
            <FaComments className="text-xl" />
          </Link>
          <div className="flex-1 min-w-0 relative" ref={dropdownRef}>
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm pointer-events-none" />
              <input
                type="search"
                placeholder={t(effectiveLang, 'Search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                className={`w-full h-9 pl-9 pr-3 rounded-full bg-white dark:bg-gray-100 text-slate-900 placeholder-slate-400 text-sm shadow-sm focus:outline-none ${HEADER_SEARCH_BORDER}`}
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
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4 sm:gap-5">
          {/* Notifications */}
          <Link
            href="/notifications"
            className="relative inline-flex p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/55 dark:focus-visible:ring-rose-500/45 rounded-md"
          >
            <div className="relative group">
              <FaBell
                className="text-xl text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors duration-200 cursor-pointer"
              />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-blue-500 text-white text-[10px] font-semibold px-0.5 py-0 rounded-full shadow-sm leading-none min-w-[1rem] h-4 inline-flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          </Link>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors duration-200 text-2xl p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/55 dark:focus-visible:ring-rose-500/45 rounded-md"
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
