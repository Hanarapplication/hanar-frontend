'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, Menu, ArrowLeft, ChevronRight, Languages } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { supportedLanguages } from '@/utils/languages';
import { t } from '@/utils/translations';

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

const MOVE_CANCEL_PX = 12;

const rowClass =
  'group flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800';

const iconChipClass =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 transition-colors group-hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:group-hover:bg-slate-700 [&_svg]:h-4 [&_svg]:w-4';

const chevronClass =
  'mr-0.5 h-3 w-3 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300';

export function DashboardBurgerMenu({ open, onOpen, onClose, items }: DashboardBurgerMenuProps) {
  const openButtonPointerOrigin = useRef<{ x: number; y: number } | null>(null);
  const openButtonPointerCancelled = useRef(false);
  const { lang, setLang, effectiveLang } = useLanguage();
  const logoutItem = items.length > 0 ? items[items.length - 1] : null;
  const primaryItems = items.length > 0 ? items.slice(0, -1) : [];

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
          onPointerDown={(e) => {
            openButtonPointerOrigin.current = { x: e.clientX, y: e.clientY };
            openButtonPointerCancelled.current = false;
          }}
          onPointerMove={(e) => {
            if (!openButtonPointerOrigin.current) return;
            const dx = e.clientX - openButtonPointerOrigin.current.x;
            const dy = e.clientY - openButtonPointerOrigin.current.y;
            if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) openButtonPointerCancelled.current = true;
          }}
          onPointerUp={() => {
            openButtonPointerOrigin.current = null;
          }}
          onPointerCancel={() => {
            openButtonPointerOrigin.current = null;
            openButtonPointerCancelled.current = true;
          }}
          onClick={() => {
            if (openButtonPointerCancelled.current) {
              openButtonPointerCancelled.current = false;
              return;
            }
            onOpen();
          }}
          className="flex w-full items-center gap-3 border-y border-slate-200 bg-white px-5 py-4 text-slate-900 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          aria-label={t(effectiveLang, 'Open menu')}
        >
          <Menu className="h-7 w-7 shrink-0" aria-hidden />
          <span className="text-lg font-semibold tracking-tight">{t(effectiveLang, 'Dashboard Menu')}</span>
          <ArrowLeft className="h-6 w-6 shrink-0 animate-pulse text-slate-500 dark:text-slate-300" aria-hidden />
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
        aria-label={t(effectiveLang, 'Dashboard menu')}
        className={[
          'fixed left-0 top-14 z-[80] h-[calc(100vh-3.5rem)] w-[min(100vw-1rem,20rem)] max-w-full flex-col overflow-hidden rounded-r-[1.75rem] border-r border-slate-200 bg-white shadow-[12px_0_48px_-12px_rgba(2,6,23,0.35)] dark:border-slate-700 dark:bg-slate-900 sm:top-16 sm:h-[calc(100vh-4rem)] sm:w-[22rem]',
          'pb-[max(7rem,env(safe-area-inset-bottom))]',
          open ? 'flex' : 'hidden',
        ].join(' ')}
        aria-hidden={!open}
      >
        <div className="shrink-0 border-b border-slate-200 bg-white px-2.5 pb-1.5 pt-[max(0.35rem,env(safe-area-inset-top))] dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-1.5 pt-0.5">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">{t(effectiveLang, 'Your dashboard')}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 shadow-sm transition hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus-visible:ring-slate-500"
              aria-label={t(effectiveLang, 'Close menu')}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>

        <nav
          className="flex min-h-0 flex-1 touch-pan-y flex-col gap-1 overflow-y-auto overscroll-contain bg-white px-3 py-3 pb-20 scroll-pb-56 dark:bg-slate-900"
          style={{ WebkitOverflowScrolling: 'touch' }}
          onTouchStartCapture={(e) => e.stopPropagation()}
          onTouchMoveCapture={(e) => e.stopPropagation()}
        >
          <ul className="flex flex-col gap-1 pb-16">
            {primaryItems.map((item, i) => {
              const content = (
                <>
                  {item.icon ? <span className={`${iconChipClass} ${item.color || ''}`}>{item.icon}</span> : null}
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                    <span className="text-[0.92rem] font-medium tracking-tight text-slate-900 dark:text-slate-100">{t(effectiveLang, item.label)}</span>
                    {item.subtitle ? (
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{t(effectiveLang, item.subtitle)}</span>
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
                      className={`${rowClass} text-slate-900 dark:text-slate-100`}
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
                      className={`${rowClass} text-left text-slate-900 dark:text-slate-100`}
                    >
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
            <li className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
              <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                <Languages className="h-3.5 w-3.5 text-slate-700 dark:text-slate-200" aria-hidden />
                {t(effectiveLang, 'Language')}
              </label>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="mt-2 w-full cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-xs font-medium text-slate-800 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/35 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                style={{
                  backgroundImage:
                    'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.65rem center',
                  backgroundSize: '0.75rem',
                }}
              >
                {supportedLanguages.map(({ code, name, emoji }) => (
                  <option key={code} value={code}>
                    {emoji} {t(effectiveLang, name)}
                  </option>
                ))}
              </select>
            </li>
            <li aria-hidden className="h-16 shrink-0" />
          </ul>
        </nav>

        <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
          {logoutItem ? (
            logoutItem.href ? (
              <Link
                href={logoutItem.href}
                onClick={() => {
                  onClose();
                  logoutItem.onClick?.();
                }}
                className={`${rowClass} text-slate-900 dark:text-slate-100`}
              >
                {logoutItem.icon ? <span className={`${iconChipClass} ${logoutItem.color || ''}`}>{logoutItem.icon}</span> : null}
                <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                  <span className="text-[0.92rem] font-medium tracking-tight text-slate-900 dark:text-slate-100">{t(effectiveLang, logoutItem.label)}</span>
                  {logoutItem.subtitle ? (
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{t(effectiveLang, logoutItem.subtitle)}</span>
                  ) : null}
                </span>
                <ChevronRight className={chevronClass} aria-hidden />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  logoutItem.onClick?.();
                  onClose();
                }}
                className={`${rowClass} text-left text-slate-900 dark:text-slate-100`}
              >
                {logoutItem.icon ? <span className={`${iconChipClass} ${logoutItem.color || ''}`}>{logoutItem.icon}</span> : null}
                <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                  <span className="text-[0.92rem] font-medium tracking-tight text-slate-900 dark:text-slate-100">{t(effectiveLang, logoutItem.label)}</span>
                  {logoutItem.subtitle ? (
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{t(effectiveLang, logoutItem.subtitle)}</span>
                  ) : null}
                </span>
                <ChevronRight className={chevronClass} aria-hidden />
              </button>
            )
          ) : null}
        </div>
      </aside>
    </>
  );
}
