'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import LocationPromptModal from '@/components/LocationPrompt';
import ClientRedirectTracker from '@/components/ClientRedirectTracker';
import HanarAIWidget from '@/components/HanarAIWidget';

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
    pathname === '/reset-password';

  // Re-trigger enter animation on every route change
  const [animKey, setAnimKey] = useState(pathname);
  const [isChromeHidden, setIsChromeHidden] = useState(false);
  useEffect(() => {
    setAnimKey(pathname);
  }, [pathname]);

  useEffect(() => {
    setIsChromeHidden(false);
  }, [pathname]);

  if (isBusinessSlugPage || isAuthPage) {
    return (
      <main key={animKey} className="animate-route-swap-soft">
        {children}
      </main>
    );
  }

  return (
    <>
      <LocationPromptModal />
      <Navbar hidden={isChromeHidden} />
      <ClientRedirectTracker />
      <main
        key={animKey}
        className="animate-route-swap-soft pb-14 sm:pb-16"
      >
        {children}
      </main>
      <HanarAIWidget />
    </>
  );
}
