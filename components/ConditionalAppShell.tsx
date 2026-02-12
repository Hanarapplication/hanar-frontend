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

  // Re-trigger enter animation on every route change
  const [animKey, setAnimKey] = useState(pathname);
  useEffect(() => {
    setAnimKey(pathname);
  }, [pathname]);

  if (isBusinessSlugPage || isAdminPage) {
    return <>{children}</>;
  }

  return (
    <>
      <LocationPromptModal />
      <Navbar />
      <MobileTopNav />
      <ClientRedirectTracker />
      <main key={animKey} className="animate-page-enter">
        {children}
      </main>
      <HanarAIWidget />
    </>
  );
}
