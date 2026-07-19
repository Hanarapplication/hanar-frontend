import { cn } from '@/lib/utils';

type WhatsAppIconProps = {
  className?: string;
  /** Prefer className `h-6 w-6` like Lucide icons — size is only a fallback. */
  size?: number | string;
  strokeWidth?: number;
};

/**
 * Same rendering model as Lucide Mail / Phone (className + strokeWidth).
 * Avoid react-icons here — rem/em sizing made the glyph look soft in the action circles.
 */
export function WhatsAppIcon({
  className,
  size = 24,
  strokeWidth = 2.25,
}: WhatsAppIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn(className)}
    >
      <path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9" />
      <path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1" />
    </svg>
  );
}
