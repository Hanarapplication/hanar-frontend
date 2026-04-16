'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, Menu, MessageCircle, Search } from 'lucide-react';
import MobileMenu from './MobileMenu';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';
import { writeSavedSearchRadiusMiles } from '@/lib/geoDistance';
import { hanarTheme } from '@/lib/hanarTheme';

/** Gradient “ring” around the search field (same palette as icons / bottom nav) */
const HEADER_SEARCH_FRAME =
  'rounded-full p-[1.5px] bg-gradient-to-r from-[#4a0a14] via-[#e1306c] to-[#4a0a14] dark:from-[#2d0610] dark:via-[#c41e56] dark:to-[#2d0610] shadow-[inset_0_1px_0_rgba(255,182,198,0.45)] dark:shadow-[inset_0_1px_0_rgba(255,120,160,0.2)] ring-1 ring-white/20 dark:ring-white/10';

const HEADER_SEARCH_INPUT =
  'w-full h-9 pl-9 pr-3 rounded-full bg-transparent text-slate-900 placeholder-slate-400 dark:text-slate-900 text-sm shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e1306c]/45 dark:focus-visible:ring-[#f472b6]/40 focus-visible:ring-inset';

/** Gradient frame around messages / bell / menu (matches bottom nav tones); white inner chip */
const HEADER_ICON_FRAME =
  'group inline-flex shrink-0 rounded-xl bg-gradient-to-r from-[#4a0a14] via-[#e1306c] to-[#4a0a14] p-[2px] shadow-sm transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.97] dark:from-[#2d0610] dark:via-[#c41e56] dark:to-[#2d0610]';

const HEADER_ICON_INNER =
  'flex h-9 w-9 items-center justify-center rounded-[10px] bg-white dark:bg-white';

const HEADER_ICON_FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600/55 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-red-500/45 dark:focus-visible:ring-offset-white';

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

  // Close search on outside tap/click — pointerdown works for mouse, touch, and pen (mousedown alone misses many mobile browsers)
  useEffect(() => {
    const handlePointerDownOutside = (e: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDownOutside, true);
    return () => document.removeEventListener('pointerdown', handlePointerDownOutside, true);
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
      <nav className="sticky top-0 z-50 flex h-14 items-center justify-between bg-gradient-to-r from-sky-100 to-rose-100 px-3 dark:from-slate-900/60 dark:to-rose-950/40 sm:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 active:scale-[0.97]"
            aria-label="Toggle Menu"
          >
            <Menu className={`h-6 w-6 ${hanarTheme.iconNav}`} strokeWidth={2} aria-hidden />
          </button>
          <Link href="/" className="text-[2rem] font-serif font-bold lowercase leading-none tracking-[0.015em]">
            <span className={hanarTheme.brandGradientText}>hanar</span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href="/notifications"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
            aria-label="Notifications"
          >
            <Bell className={`h-[1.2rem] w-[1.2rem] ${hanarTheme.iconNav}`} strokeWidth={2} aria-hidden />
            {unreadCount > 0 && (
              <span className="absolute right-0 top-0 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-semibold leading-none text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
          <Link
            href="/messages"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
            aria-label="Messages"
          >
            <MessageCircle className={`h-[1.22rem] w-[1.22rem] ${hanarTheme.iconNav}`} strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </nav>

      <nav className="sticky top-0 z-50 hidden h-[3.75rem] items-center justify-between gap-2 bg-gradient-to-r from-sky-100 to-rose-100 px-3 shadow-sm transition-all isolate dark:from-slate-900/60 dark:to-rose-950/40 sm:flex sm:h-16">
        {/* Messages + search */}
        <div className="flex flex-1 max-w-md mx-1.5 sm:mx-3 items-center gap-2 sm:gap-2.5 min-w-0">
          <Link
            href="/messages"
            className={`${HEADER_ICON_FRAME} ${HEADER_ICON_FOCUS}`}
            aria-label="Messages"
          >
            <span className={HEADER_ICON_INNER}>
              <MessageCircle className={`h-5 w-5 ${hanarTheme.iconHeaderChip}`} strokeWidth={2} aria-hidden />
            </span>
          </Link>
          <div className="flex-1 min-w-0 relative" ref={dropdownRef}>
            <div className={`relative ${HEADER_SEARCH_FRAME}`}>
              <div className="relative rounded-full bg-white dark:bg-gray-100">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#c41e56] dark:text-[#e85085]"
                  strokeWidth={2}
                  aria-hidden
                />
                <input
                  type="search"
                  placeholder={t(effectiveLang, 'Search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchOpen(true)}
                  className={HEADER_SEARCH_INPUT}
                  aria-label="Search"
                />
              </div>
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
                          onPointerDown={(e) => e.preventDefault()}
                          onClick={() => handleSearchSelect(item.href)}
                          className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors cursor-pointer touch-manipulation"
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
            className={`relative ${HEADER_ICON_FRAME} ${HEADER_ICON_FOCUS}`}
          >
            <span className={HEADER_ICON_INNER}>
              <Bell className={`h-5 w-5 ${hanarTheme.iconHeaderChip}`} strokeWidth={2} aria-hidden />
            </span>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-500 px-0.5 py-0 text-[10px] font-semibold leading-none text-white shadow-sm ring-2 ring-white dark:ring-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className={`${HEADER_ICON_FRAME} ${HEADER_ICON_FOCUS}`}
            aria-label="Toggle Menu"
          >
            <span className={HEADER_ICON_INNER}>
              <Menu className={`h-5 w-5 ${hanarTheme.iconHeaderChip}`} strokeWidth={2} aria-hidden />
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      <MobileMenu isOpen={menuOpen} setIsOpen={setMenuOpen} />
    </>
  );
}
