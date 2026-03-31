'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, Menu, ArrowLeft, ChevronRight } from 'lucide-react';

export type MenuItem = {
  label: string;
  /** Optional short line under the label for clarity */
  subtitle?: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  color?: string;
};

type DashboardBurgerMenuProps = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  items: MenuItem[];
};

const SWIPE_THRESHOLD = 50;

const rowClass =
  'group flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 transition-all duration-200 hover:border-white/20 hover:bg-black/30 active:scale-[0.99]';

const iconChipClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-black/30 text-white transition-colors group-hover:bg-black/40 [&_svg]:h-[1.1rem] [&_svg]:w-[1.1rem]';

const chevronClass =
  'mr-0.5 h-3 w-3 shrink-0 text-white/45 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white/70';

export function DashboardBurgerMenu({ open, onOpen, onClose, items }: DashboardBurgerMenuProps) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <>
      {/* Full-width bar under site navbar */}
      <div className="-mx-4 -mt-16 mb-4 sm:-mx-6 lg:-mx-8">
        <button
          type="button"
          onClick={onOpen}
          onTouchStart={(e) => {
            touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }}
          onTouchEnd={(e) => {
            if (!touchStart.current) return;
            const dx = e.changedTouches[0].clientX - touchStart.current.x;
            const dy = e.changedTouches[0].clientY - touchStart.current.y;
            touchStart.current = null;
            if (Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(dy) > SWIPE_THRESHOLD) {
              e.preventDefault();
            }
          }}
          className="flex w-full items-center gap-3 bg-gradient-to-r from-[#4a0a14] via-[#e1306c] to-[#4a0a14] px-5 py-3.5 text-white shadow-[inset_0_1px_0_rgba(255,182,198,0.45)] transition hover:brightness-105 dark:from-[#2d0610] dark:via-[#c41e56] dark:to-[#2d0610] dark:shadow-[inset_0_1px_0_rgba(255,120,160,0.2)]"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6 shrink-0" aria-hidden />
          <span className="text-base font-semibold tracking-tight">Dashboard Menu</span>
          <ArrowLeft className="h-5 w-5 shrink-0 animate-pulse" aria-hidden />
        </button>
      </div>

      {/* Overlay */}
      <div
        role="presentation"
        onClick={onClose}
        className={`fixed inset-0 z-[70] bg-black/50 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!open}
      />

      {/* Slide panel from left */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard menu"
        className={[
          'fixed inset-y-0 left-0 z-[80] flex h-full w-[min(100vw-1rem,20rem)] max-w-full flex-col rounded-r-[1.75rem] border-r border-white/20 shadow-[12px_0_48px_-12px_rgba(0,0,0,0.45)] sm:w-[22rem]',
          'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
          'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          open ? 'translate-x-0' : '-translate-x-full pointer-events-none',
        ].join(' ')}
        aria-hidden={!open}
      >
        <div className="shrink-0 border-b border-white/20 bg-gradient-to-r from-[#4a0a14] via-[#e1306c] to-[#4a0a14] px-4 pb-5 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-[inset_0_1px_0_rgba(255,182,198,0.45)] dark:from-[#2d0610] dark:via-[#c41e56] dark:to-[#2d0610] dark:shadow-[inset_0_1px_0_rgba(255,120,160,0.2)]">
          <div className="flex items-center justify-between gap-3 pt-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">Your dashboard</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-black/20 text-white shadow-sm transition hover:bg-black/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain bg-gradient-to-b from-[#2d0610] to-[#140508] px-4 py-4 dark:from-[#2d0610] dark:to-black">
          <ul className="flex flex-col gap-1">
            {items.map((item, i) => {
              const content = (
                <>
                  {item.icon ? <span className={iconChipClass}>{item.icon}</span> : null}
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                    <span className="text-sm font-medium tracking-tight text-white/90">{item.label}</span>
                    {item.subtitle ? (
                      <span className="text-xs font-normal text-white/55">{item.subtitle}</span>
                    ) : null}
                  </span>
                  <ChevronRight className={chevronClass} aria-hidden />
                </>
              );

              return (
                <li key={i}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={() => {
                        onClose();
                        item.onClick?.();
                      }}
                      className={`${rowClass} text-white`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        item.onClick?.();
                        onClose();
                      }}
                      className={`${rowClass} text-left text-white`}
                    >
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
