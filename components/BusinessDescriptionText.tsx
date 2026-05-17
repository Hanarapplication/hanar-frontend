'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

type BusinessDescriptionTextProps = {
  text?: string | null;
  className?: string;
  style?: CSSProperties;
  fallback?: string;
  readMoreLabel?: string;
  readLessLabel?: string;
};

/** Shows up to 4 lines of description with Read more / Read less when content overflows. */
export function BusinessDescriptionText({
  text,
  className,
  style,
  fallback,
  readMoreLabel = 'Read more',
  readLessLabel = 'Read less',
}: BusinessDescriptionTextProps) {
  const content = (text || '').trim();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const paraRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = paraRef.current;
    if (!el || !content) {
      setOverflows(false);
      return;
    }
    if (expanded) return;

    const check = () => {
      setOverflows(el.scrollHeight > el.clientHeight + 2);
    };

    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [content, expanded]);

  if (!content) {
    if (fallback === undefined || fallback === '') return null;
    return (
      <p className={className} style={style}>
        {fallback}
      </p>
    );
  }

  const showToggle = overflows || expanded;

  return (
    <div>
      <p ref={paraRef} className={cn(className, !expanded && 'line-clamp-4')} style={style}>
        {content}
      </p>
      {showToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          {expanded ? readLessLabel : readMoreLabel}
        </button>
      ) : null}
    </div>
  );
}
