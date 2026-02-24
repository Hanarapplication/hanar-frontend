'use client';

import { useState } from 'react';

export const HANAR_AVATAR_URL = '/hanar.logo.png';

type AvatarProps = {
  src?: string | null;
  alt?: string;
  className?: string;
};

/**
 * Renders a profile/org avatar. When there is no src or the image fails to load,
 * shows the Hanar logo in grey (grayscale) as the default avatar.
 */
export function Avatar({ src, alt = '', className = '' }: AvatarProps) {
  const [useFallback, setUseFallback] = useState(!src);
  const effectiveSrc = src && !useFallback ? src : HANAR_AVATAR_URL;
  const isHanar = effectiveSrc === HANAR_AVATAR_URL || useFallback;

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      className={`${className} ${isHanar ? 'grayscale object-contain bg-slate-200 dark:bg-gray-600' : 'object-cover'}`}
      onError={() => setUseFallback(true)}
    />
  );
}
