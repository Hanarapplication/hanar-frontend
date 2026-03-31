'use client';

import { useState } from 'react';

export const HANAR_AVATAR_URL = '/hanar.logo.png';

/** Thin Instagram-tone inset ring — default on `<Avatar />` (omit with `unframed`). */
export const AVATAR_GOLD_RING =
  'ring-1 ring-inset ring-[#c41e56]/82 dark:ring-[#e85085]/55';

/** Accent border for square logos / listing thumbs (matches header & cards). */
export const LOGO_GOLD_BORDER =
  'border border-[#c41e56]/88 dark:border-[#e85085]/68';

type AvatarProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  /** When parent already has a gold frame (e.g. profile hero). */
  unframed?: boolean;
};

/**
 * Renders a profile/org avatar. When there is no src or the image fails to load,
 * shows the Hanar logo in grey (grayscale) as the default avatar.
 */
export function Avatar({ src, alt = '', className = '', unframed = false }: AvatarProps) {
  const [useFallback, setUseFallback] = useState(!src);
  const effectiveSrc = src && !useFallback ? src : HANAR_AVATAR_URL;
  const isHanar = effectiveSrc === HANAR_AVATAR_URL || useFallback;
  const frame = unframed ? '' : AVATAR_GOLD_RING;

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      className={`${className} ${frame} ${isHanar ? 'grayscale object-contain bg-slate-200 dark:bg-gray-600' : 'object-cover'}`}
      onError={() => setUseFallback(true)}
    />
  );
}
