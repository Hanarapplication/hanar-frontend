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
      className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-[#0c1f3c] via-[#b91c1c] to-[#0c1f3c] dark:from-[#061018] dark:via-[#991b1b] dark:to-[#061018] border-t border-white/20 dark:border-white/10 shadow-[inset_0_1px_0_rgba(140,170,230,0.35)] dark:shadow-[inset_0_1px_0_rgba(180,70,80,0.22)] pb-[max(0.35rem,env(safe-area-inset-bottom))] transition-colors duration-200"
      aria-label="Primary"
    >
      <div className="flex justify-around items-end gap-0.5 px-1 pt-1.5 pb-0 sm:px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const bubble = [
            'flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl transition-all duration-200 ease-out',
            isActive
              ? 'bg-black/20 text-white shadow-sm dark:bg-black/30'
              : 'text-white/85 hover:text-white hover:bg-black/10 active:scale-[0.97] dark:text-white/80 dark:hover:bg-black/20',
          ].join(' ');

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.href === '/' ? t(effectiveLang, 'Feed') : undefined}
              className="relative flex min-w-0 flex-1 max-w-[5.25rem] flex-col items-center gap-0 rounded-lg py-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-[#b91c1c] dark:focus-visible:ring-white/65 dark:focus-visible:ring-offset-[#991b1b]"
            >
              <span className={bubble}>{item.icon}</span>
              {item.label ? (
                <span
                  className={`w-full truncate text-center text-[9px] sm:text-[10px] leading-none tracking-wide -mt-px ${
                    isActive
                      ? 'font-semibold text-white'
                      : 'font-medium text-white/80 hover:text-white'
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
