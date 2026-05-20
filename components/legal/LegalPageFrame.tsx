import Link from 'next/link';
import type { ReactNode } from 'react';

type LegalNavItem = { href: string; label: string };

const defaultNav: LegalNavItem[] = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/child-safety', label: 'Child safety' },
  { href: '/delete-account', label: 'Delete account' },
];

export default function LegalPageFrame({
  title,
  subtitle,
  children,
  navItems = defaultNav,
  showDisclaimer = true,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  navItems?: LegalNavItem[];
  /** When false, only the support line is shown (e.g. operational pages like account deletion). */
  showDisclaimer?: boolean;
}) {
  return (
    <div className="min-h-[60vh] bg-white dark:bg-transparent">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 text-gray-800 dark:text-[#e4e6eb]">
        <nav
          className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-gray-600 dark:text-[#b0b3b8] mb-8 pb-4 border-b border-gray-200 dark:border-[#3e4042]"
          aria-label="Legal pages"
        >
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-rose-700 hover:text-rose-800 underline-offset-2 hover:underline dark:text-rose-400 dark:hover:text-rose-300"
            >
              {label}
            </Link>
          ))}
        </nav>

        <header className="mb-10">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-rose-700 dark:text-rose-400 mb-2">
            {title}
          </h1>
          {subtitle != null && subtitle !== '' ? (
            <div className="text-sm sm:text-base text-gray-600 dark:text-[#b0b3b8] leading-relaxed space-y-1">
              {typeof subtitle === 'string' ? <p>{subtitle}</p> : subtitle}
            </div>
          ) : null}
        </header>

        <div className="space-y-6 text-[15px] sm:text-base leading-relaxed [&_h2]:scroll-mt-24 [&_h3]:scroll-mt-24">
          {children}
        </div>

        <footer className="mt-12 pt-8 border-t border-gray-200 dark:border-[#3e4042] text-sm text-gray-600 dark:text-[#b0b3b8] leading-relaxed">
          <p className="mb-4">
            Questions? Contact{' '}
            <a
              href="mailto:support@hanar.net"
              className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400"
            >
              support@hanar.net
            </a>
            .
          </p>
          {showDisclaimer ? (
            <p className="text-xs text-gray-500 dark:text-[#8a8d91]">
              This document is provided for transparency and convenience. It does not constitute legal advice. Hanar may
              update this information to reflect product, legal, or regulatory changes.
            </p>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
