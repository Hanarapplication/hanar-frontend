'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import LocationPromptModal from '@/components/LocationPrompt';
import ClientRedirectTracker from '@/components/ClientRedirectTracker';
import HanarAIWidget from '@/components/HanarAIWidget';
import HanarAppIntentSync from '@/components/HanarAppIntentSync';

/**
 * On /business/[slug] and /admin/* we render only the page (no Hanar nav, location, notifications, AI).
 * Everywhere else we render the full Hanar shell.
 */
export default function ConditionalAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const segments = pathname.split('/').filter(Boolean);
  const isBusinessSlugPage =
    segments.length === 2 &&
    segments[0] === 'business' &&
    segments[1] !== 'plan';
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/admin-login';
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');

  // Re-trigger enter animation on every route change
  const [animKey, setAnimKey] = useState(pathname);
  const [isChromeHidden, setIsChromeHidden] = useState(false);
  const [homeBottomBarDocked, setHomeBottomBarDocked] = useState(true);
  useEffect(() => {
    setAnimKey(pathname);
  }, [pathname]);

  useEffect(() => {
    setIsChromeHidden(false);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/') setHomeBottomBarDocked(true);
  }, [pathname]);

  if (isBusinessSlugPage || isAuthPage || isAdminRoute) {
    /** Auth/admin: skip route enter animation so fixed full-screen pages are never opacity-0. */
    const shellClass =
      isAuthPage || isAdminRoute
        ? 'pt-2 sm:pt-3'
        : 'animate-route-swap-soft pt-2 sm:pt-3';
    return (
      <>
        <HanarAppIntentSync />
        <main key={animKey} className={shellClass}>
          {children}
        </main>
      </>
    );
  }

  const isHomeFeedShell = pathname === '/';

  return (
    <>
      <HanarAppIntentSync />
      <LocationPromptModal />
      <Navbar hidden={isChromeHidden} onHomeBottomBarDocked={setHomeBottomBarDocked} />
      <ClientRedirectTracker />
      <main
        key={animKey}
        className={`animate-route-swap-soft ${
          isHomeFeedShell
            ? `pt-[calc(4rem+env(safe-area-inset-top,0px))] ${
                homeBottomBarDocked
                  ? 'pb-[calc(4rem+env(safe-area-inset-bottom,0px)+1rem)]'
                  : 'pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]'
              }`
            : 'pt-[calc(4rem+env(safe-area-inset-top,0px))] pb-6 sm:pb-8'
        }`}
      >
        {children}
      </main>
      <HanarAIWidget />
    </>
  );
}
