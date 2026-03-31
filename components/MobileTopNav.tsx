'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { FaStore, FaUsers, FaShoppingCart } from 'react-icons/fa';
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
      icon: <FaUsers className={navFaIconClass} />,
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
      className="fixed bottom-0 left-0 right-0 z-40 overflow-visible rounded-none border-x-0 border-b-0 border border-white/32 bg-[radial-gradient(160%_120%_at_50%_-15%,rgba(255,255,255,0.46)_0%,rgba(255,255,255,0.18)_24%,rgba(255,255,255,0.02)_44%,rgba(255,255,255,0)_64%),linear-gradient(90deg,rgba(8,18,42,0.98)_0%,rgba(33,76,176,0.98)_50%,rgba(8,18,42,0.98)_100%)] shadow-[0_8px_24px_rgba(2,6,23,0.4),inset_0_1px_0_rgba(250,253,255,0.72),inset_0_-1px_0_rgba(3,20,52,0.5)] backdrop-blur-xl pb-[max(0.32rem,env(safe-area-inset-bottom))] transition-colors duration-200 dark:border-white/16 dark:bg-[radial-gradient(160%_120%_at_50%_-15%,rgba(225,238,255,0.3)_0%,rgba(225,238,255,0.1)_24%,rgba(225,238,255,0.02)_44%,rgba(225,238,255,0)_64%),linear-gradient(90deg,rgba(6,12,30,0.98)_0%,rgba(24,60,145,0.98)_50%,rgba(6,12,30,0.98)_100%)]"
      aria-label="Primary"
    >
      <div className="flex justify-around items-end gap-0.5 px-1.5 pt-1.5 pb-0 sm:px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const bubble = [
            'flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl transition-all duration-200 ease-out',
            isActive
              ? 'bg-gradient-to-br from-[#2b0710] via-[#7f1d1d] to-[#4a0a14] text-white shadow-[inset_0_1px_0_rgba(255,210,220,0.2),0_6px_14px_rgba(90,12,24,0.32)]'
              : 'text-white/90 hover:text-white hover:bg-white/10 active:scale-[0.97] dark:text-white/85 dark:hover:bg-white/10',
          ].join(' ');

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.href === '/' ? t(effectiveLang, 'Feed') : undefined}
              className="relative flex min-w-0 flex-1 max-w-[5rem] flex-col items-center gap-0.5 rounded-xl py-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b3a7a] dark:focus-visible:ring-white/70 dark:focus-visible:ring-offset-[#082b68]"
            >
              <span className={bubble}>{item.icon}</span>
              {item.label ? (
                <span
                  className={`w-full truncate text-center text-[9px] sm:text-[10px] leading-none tracking-wide ${
                    isActive
                      ? 'font-semibold text-white'
                      : 'font-medium text-white/85 hover:text-white'
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
