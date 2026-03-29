'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { FaStore, FaComments, FaShoppingCart } from 'react-icons/fa';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';

const navFaIconClass = 'text-lg sm:text-xl';

export default function MobileTopNav() {
  const pathname = usePathname();
  const { effectiveLang } = useLanguage();

  useSwipeNavigation();

  const navItems: { href: string; icon: ReactNode; label?: string }[] = [
    {
      href: '/',
      icon: (
        <Image
          src="/hanar.logo.png"
          alt=""
          width={36}
          height={36}
          className="h-7 w-auto max-h-7 max-w-[2.85rem] sm:h-8 sm:max-h-8 sm:max-w-[3.25rem] object-contain"
          unoptimized
        />
      ),
      label: t(effectiveLang, 'Feed'),
    },
    {
      href: '/community',
      icon: <FaComments className={navFaIconClass} />,
      label: t(effectiveLang, 'Community'),
    },
    {
      href: '/marketplace',
      icon: <FaShoppingCart className={navFaIconClass} />,
      label: t(effectiveLang, 'Marketplace'),
    },
    {
      href: '/businesses',
      icon: <FaStore className={navFaIconClass} />,
      label: t(effectiveLang, 'Businesses'),
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-rose-800 dark:bg-rose-900 border-t border-rose-700/90 dark:border-rose-800 shadow-[0_-8px_22px_-10px_rgba(0,0,0,0.34)] pb-[max(0.35rem,env(safe-area-inset-bottom))] transition-all duration-200"
      aria-label="Primary"
    >
      <div className="flex justify-around items-end gap-0.5 px-1 pt-1.5 pb-0 sm:px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const bubble = [
            'flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl transition-all duration-200 ease-out',
            isActive
              ? 'bg-white/25 text-amber-50 shadow-[0_4px_12px_-5px_rgba(0,0,0,0.42)] ring-1 ring-amber-300/55 dark:ring-amber-400/45 -translate-y-0.5'
              : 'text-rose-100/92 hover:text-white hover:bg-white/12 active:scale-[0.97] active:bg-white/8',
          ].join(' ');

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.href === '/' ? t(effectiveLang, 'Feed') : undefined}
              className="relative flex min-w-0 flex-1 max-w-[5.25rem] flex-col items-center gap-0 rounded-lg py-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:ring-offset-1 focus-visible:ring-offset-rose-800 dark:focus-visible:ring-offset-rose-900"
            >
              <span className={bubble}>{item.icon}</span>
              {item.label ? (
                <span
                  className={`w-full truncate text-center text-[9px] sm:text-[10px] leading-none tracking-wide -mt-px ${
                    isActive
                      ? 'font-semibold text-amber-100'
                      : 'font-medium text-rose-200/90'
                  }`}
                >
                  {item.label}
                </span>
              ) : (
                <span className="h-[10px] shrink-0" aria-hidden />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
