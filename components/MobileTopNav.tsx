'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaStore, FaShoppingCart, FaHome, FaUserCircle } from 'react-icons/fa';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';

const navFaIconClass = 'text-[1.32rem]';

export default function MobileTopNav() {
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
      className="fixed left-0 right-0 top-14 z-40 bg-gradient-to-r from-sky-100 to-rose-100 dark:from-slate-900/60 dark:to-rose-950/40 sm:hidden"
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
              className={`relative flex h-12 min-w-0 flex-1 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/55 ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {item.icon}
              <span
                className={`absolute bottom-0 left-2 right-2 h-[3px] rounded-full transition-opacity ${
                  isActive ? 'bg-blue-600 opacity-100 dark:bg-blue-400' : 'opacity-0'
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
