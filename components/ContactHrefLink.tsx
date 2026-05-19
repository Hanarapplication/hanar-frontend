'use client';

import type { CSSProperties, ReactNode } from 'react';
import { openContactUrl } from '@/lib/openContactUrl';

type ContactHrefLinkProps = {
  href: string;
  className?: string;
  ariaLabel?: string;
  style?: CSSProperties;
  children: ReactNode;
  onClick?: () => void;
  target?: string;
  rel?: string;
};

function isManagedContactHref(href: string): boolean {
  const h = href.trim().toLowerCase();
  return h.startsWith('tel:') || h.startsWith('mailto:');
}

/** tel:/mailto: as button + guarded open (WebView-safe). Other hrefs stay normal anchors. */
export function ContactHrefLink({
  href,
  className,
  ariaLabel,
  style,
  children,
  onClick,
  target,
  rel,
}: ContactHrefLinkProps) {
  if (!isManagedContactHref(href)) {
    return (
      <a href={href} className={className} aria-label={ariaLabel} style={style} target={target} rel={rel} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      style={style}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openContactUrl(href);
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}
