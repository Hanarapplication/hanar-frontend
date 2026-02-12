'use client';

import { useEffect } from 'react';
import { X, Heart } from 'lucide-react';

type FavoritesSlideMenuProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
};

export function FavoritesSlideMenu({ open, onClose, children, title = 'Favorites' }: FavoritesSlideMenuProps) {
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
      {/* Overlay */}
      <div
        role="presentation"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Slide panel */}
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-xl transition-transform duration-300 ease-out sm:max-w-sm ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-700 px-5 py-4">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-rose-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-700"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </div>
      </aside>
    </>
  );
}
