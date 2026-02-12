'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FaMapMarkerAlt, FaBell, FaBars } from 'react-icons/fa';
import { usePathname } from 'next/navigation';
import MobileMenu from './MobileMenu';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

export default function Navbar() {
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const { effectiveLang } = useLanguage();

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
    setLocationLabel(null);
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        localStorage.setItem('userCoords', JSON.stringify({ lat, lon }));
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
