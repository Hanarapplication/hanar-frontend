'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { X, Menu, ArrowLeft } from 'lucide-react';

export type MenuItem = {
  label: string;
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

export function DashboardBurgerMenu({ open, onOpen, onClose, items }: DashboardBurgerMenuProps) {
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
          className="flex w-full items-center gap-3 bg-rose-800 px-5 py-3.5 text-white hover:bg-rose-700 transition"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6 shrink-0" />
          <span className="text-base font-semibold">Dashboard Menu</span>
          <ArrowLeft className="h-5 w-5 shrink-0 animate-pulse" />
        </button>
      </div>

      {/* Overlay */}
      <div
        role="presentation"
        onClick={onClose}
        className={`fixed inset-0 z-[70] bg-black/50 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Slide panel from left */}
      <aside
        className={`fixed left-0 top-0 z-[80] h-full w-full max-w-sm bg-white dark:bg-gray-900 shadow-xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-700 px-6 py-5">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Menu</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-700"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-5">
            <ul className="space-y-1.5">
              {items.map((item, i) => {
                const bg = item.color || 'bg-slate-50 dark:bg-gray-800/60';
                const cls = `flex items-center gap-3.5 rounded-xl px-4 py-3.5 ${bg} hover:brightness-95 dark:hover:brightness-110 transition`;
                return (
                  <li key={i}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={() => {
                          onClose();
                          item.onClick?.();
                        }}
                        className={`${cls} text-slate-700 dark:text-gray-200`}
                      >
                        {item.icon}
                        <span className="text-[15px] font-medium">{item.label}</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          item.onClick?.();
                          onClose();
                        }}
                        className={`${cls} w-full text-left text-slate-700 dark:text-gray-200`}
                      >
                        {item.icon}
                        <span className="text-[15px] font-medium">{item.label}</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>
    </>
  );
}
