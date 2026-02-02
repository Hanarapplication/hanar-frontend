'use client';

import { MouseEvent, ReactNode } from 'react';

type LiveRefreshLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export default function LiveRefreshLink({
  href,
  className,
  children,
  onClick,
}: LiveRefreshLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onClick?.(event);
    window.location.href = href;
  };

  return (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
