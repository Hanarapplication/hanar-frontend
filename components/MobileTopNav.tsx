'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaStore, FaShoppingCart, FaHome, FaUserCircle } from 'react-icons/fa';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';

const navFaIconClass = 'text-[1.32rem]';

export default function MobileTopNav({ hidden = false }: { hidden?: boolean }) {
  const pathname = usePathname();
  const { effectiveLang } = useLanguage();

  useSwipeNavigation();

  const navItems: { key: string; href: string; icon: ReactNode; label: string; isActive: (path: string) => boolean }[] = [
    {
      key: 'home',
      href: '/',
      icon: <FaHome className={navFaIconClass} />,
      label: t(effectiveLang, 'Feed'),
      isActive: (path) => path === '/',
    },
    {
      key: 'marketplace',
      href: '/marketplace',
      icon: <FaShoppingCart className={navFaIconClass} />,
      label: t(effectiveLang, 'Marketplace'),
      isActive: (path) => path.startsWith('/marketplace'),
    },
    {
      key: 'businesses',
      href: '/businesses',
      icon: <FaStore className={navFaIconClass} />,
      label: t(effectiveLang, 'Businesses'),
      isActive: (path) => path.startsWith('/businesses') || path.startsWith('/business/'),
    },
    {
      key: 'profile',
      href: '/dashboard',
      icon: <FaUserCircle className={navFaIconClass} />,
      label: t(effectiveLang, 'Profile'),
      isActive: (path) => path.startsWith('/dashboard'),
    },
  ];

  return (
    <nav
      className={`fixed left-0 right-0 top-14 z-40 bg-gradient-to-r from-blue-700 via-blue-800 to-emerald-600 transition-all duration-200 dark:from-blue-950 dark:via-blue-900 dark:to-emerald-700 sm:top-16 ${
        hidden ? '-translate-y-[140%] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}
      aria-label="Primary"
    >
      <div className="flex items-stretch justify-between px-1">
        {navItems.map((item) => {
          const isActive = item.isActive(pathname);

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-label={item.label}
              className={`relative flex h-12 min-w-0 flex-1 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/45 ${
                isActive
                  ? 'text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              {item.icon}
              <span
                className={`absolute bottom-0 left-2 right-2 h-[3px] rounded-full transition-opacity ${
                  isActive ? 'bg-white opacity-100' : 'opacity-0'
                }`}
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
