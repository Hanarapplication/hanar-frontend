'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const FEED_ROUTES = ['/', '/community', '/marketplace', '/businesses'];

const isDashboardRoute = (path: string) =>
  path === '/dashboard' ||
  path.startsWith('/business-dashboard') ||
  path.startsWith('/organization/dashboard');

/**
 * Detects horizontal swipe gestures and navigates between the
 * four main feed pages (Home, Community, Marketplace, Businesses).
 * Disabled on dashboard pages to avoid accidental navigation.
 */
export function useSwipeNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const startX = useRef(0);
  const startY = useRef(0);
  const swiping = useRef(false);

  const currentIndex = FEED_ROUTES.indexOf(pathname);
  const shouldEnable = currentIndex >= 0 && !isDashboardRoute(pathname);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiping.current = true;
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!swiping.current || currentIndex === -1) return;
      swiping.current = false;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = endX - startX.current;
      const diffY = endY - startY.current;

      // Must be a mostly-horizontal swipe (> 80px) and not a vertical scroll
      if (Math.abs(diffX) < 80 || Math.abs(diffY) > Math.abs(diffX) * 0.7) return;

      if (diffX < 0 && currentIndex < FEED_ROUTES.length - 1) {
        // Swipe left → next page
        router.push(FEED_ROUTES[currentIndex + 1]);
      } else if (diffX > 0 && currentIndex > 0) {
        // Swipe right → previous page
        router.push(FEED_ROUTES[currentIndex - 1]);
      }
    },
    [currentIndex, router]
  );

  useEffect(() => {
    if (!shouldEnable) return;
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [shouldEnable, handleTouchStart, handleTouchEnd]);
}
