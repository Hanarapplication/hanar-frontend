'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { Bell, Menu, MessageCircle } from 'lucide-react';
import MobileMenu from './MobileMenu';
import { supabase } from '@/lib/supabaseClient';
import { writeSavedSearchRadiusMiles } from '@/lib/geoDistance';
import { hanarTheme } from '@/lib/hanarTheme';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 active:scale-[0.97]"
            aria-label="Toggle Menu"
          >
            <Menu className={`h-6 w-6 ${hanarTheme.iconNav}`} strokeWidth={2} aria-hidden />
          </button>
          <Link
            href="/"
            className="text-[2rem] font-serif font-bold lowercase leading-none tracking-[0.015em]"
            aria-label="Home"
          >
            <span className={hanarTheme.brandGradientText}>hanar</span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href="/notifications"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 active:scale-[0.97]"
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
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 active:scale-[0.97]"
            aria-label="Messages"
          >
            <MessageCircle className={`h-[1.22rem] w-[1.22rem] ${hanarTheme.iconNav}`} strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      <MobileMenu isOpen={menuOpen} setIsOpen={setMenuOpen} />
    </>
  );
}
