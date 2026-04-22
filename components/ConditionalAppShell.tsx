'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import LocationPromptModal from '@/components/LocationPrompt';
import MobileTopNav from '@/components/MobileTopNav';
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
  const isAdminPage = pathname.startsWith('/admin');
  const shouldHideNavOnScroll =
    pathname === '/' || pathname === '/businesses' || pathname === '/marketplace';

  // Re-trigger enter animation on every route change
  const [animKey, setAnimKey] = useState(pathname);
  const [isChromeHidden, setIsChromeHidden] = useState(false);
  useEffect(() => {
    setAnimKey(pathname);
  }, [pathname]);

  useEffect(() => {
    setIsChromeHidden(false);
    if (!shouldHideNavOnScroll) return;

    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      const currentY = window.scrollY;
      if (ticking) return;
      ticking = true;

      window.requestAnimationFrame(() => {
        const delta = currentY - lastY;
        if (currentY <= 8) {
          setIsChromeHidden(false);
        } else if (delta > 6) {
          setIsChromeHidden(true);
        } else if (delta < -6) {
          setIsChromeHidden(false);
        }
        lastY = currentY;
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [shouldHideNavOnScroll, pathname]);

  if (isBusinessSlugPage || isAdminPage) {
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
        className="animate-route-swap-soft pt-12 sm:pt-12"
      >
        {children}
      </main>
      <MobileTopNav hidden={isChromeHidden} />
      <HanarAIWidget />
    </>
  );
}
