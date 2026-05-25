'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type BusinessProfileLinkProps = ComponentProps<typeof Link> & {
  /** Cover the nearest positioned ancestor so the whole card/row opens on first tap. */
  stretch?: boolean;
};

function hrefToPrefetchPath(href: ComponentProps<typeof Link>['href']): string | null {
  if (typeof href === 'string') return href;
  if (href && typeof href === 'object') {
    const pathname = 'pathname' in href && href.pathname ? String(href.pathname) : '';
    if (!pathname) return null;
    const search =
      'search' in href && href.search
        ? String(href.search).startsWith('?')
          ? String(href.search)
          : `?${href.search}`
        : '';
    return `${pathname}${search}`;
  }
  return null;
}

/** Business profile navigation tuned for mobile browsers and in-app WebViews. */
export default function BusinessProfileLink({
  href,
  className,
  stretch = false,
  prefetch = true,
  onTouchStart,
  children,
  ...rest
}: BusinessProfileLinkProps) {
  const router = useRouter();
  const prefetchPath = hrefToPrefetchPath(href);

  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn(
        'touch-manipulation [-webkit-tap-highlight-color:transparent]',
        stretch && 'absolute inset-0 z-[1]',
        className
      )}
      onTouchStart={(e) => {
        if (prefetchPath) router.prefetch(prefetchPath);
        onTouchStart?.(e);
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
