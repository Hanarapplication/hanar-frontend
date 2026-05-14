'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { syncHanarAppIntentFromBrowser } from '@/lib/hanarAppAuthRedirect';

/** Persists native-app login handoff when URL has `from=app` (etc.) or WebView UA contains `HanarNativeApp`. */
export default function HanarAppIntentSync() {
  const pathname = usePathname() ?? '';
  useEffect(() => {
    syncHanarAppIntentFromBrowser();
  }, [pathname]);
  return null;
}
