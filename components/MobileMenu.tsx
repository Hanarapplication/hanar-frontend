'use client';

import Link from 'next/link';
import {
  FaTimes,
  FaQuestionCircle,
  FaPhone,
  FaLanguage,
  FaThLarge,
  FaCog,
  FaSignOutAlt,
  FaSignInAlt,
  FaChevronRight,
} from 'react-icons/fa';
import { useEffect, useState, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/context/LanguageContext';
import { supportedLanguages } from '@/utils/languages';
import { t } from '@/utils/translations';

function MenuRow({
  href,
  icon,
  label,
  active,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={[
        'group flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all duration-200',
        'border border-transparent',
        active
          ? 'bg-rose-500/[0.12] dark:bg-rose-400/15 border-rose-300/40 dark:border-rose-500/35 shadow-sm'
          : 'bg-slate-50/90 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:border-slate-200/80 dark:hover:border-slate-600/60 active:scale-[0.99]',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm transition-colors',
          active
            ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25 dark:bg-rose-500'
            : 'bg-white text-rose-600 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:text-rose-400 dark:ring-slate-600/50 group-hover:text-rose-700 dark:group-hover:text-rose-300',
        ].join(' ')}
      >
        {icon}
      </span>
      <span
        className={[
          'min-w-0 flex-1 text-sm font-medium tracking-tight',
          active ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-100',
        ].join(' ')}
      >
        {label}
      </span>
      <FaChevronRight
        className={[
          'mr-0.5 shrink-0 text-[10px] transition-transform duration-200',
          active
            ? 'text-rose-600 dark:text-rose-400 translate-x-0'
            : 'text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 group-hover:text-slate-400 dark:group-hover:text-slate-500',
        ].join(' ')}
        aria-hidden
      />
    </Link>
  );
}

export default function MobileMenu({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
}) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<'individual' | 'business' | 'organization' | null>(null);
  const { lang, setLang, effectiveLang } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();

  const dashboardHref = useMemo(() => {
    if (userRole === 'business') return '/business-dashboard';
    if (userRole === 'organization') return '/organization/dashboard';
    return '/dashboard';
  }, [userRole]);

  const isDashboardActive = useMemo(() => {
    if (userRole === 'business') return pathname.startsWith('/business-dashboard');
    if (userRole === 'organization') return pathname.startsWith('/organization/dashboard');
    return pathname.startsWith('/dashboard');
  }, [pathname, userRole]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserType = localStorage.getItem('userType');
      if (storedUserType === 'business' || storedUserType === 'organization' || storedUserType === 'individual') {
        setUserRole(storedUserType);
      }
    }

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user;
      setLoggedIn(!!user);

      if (user) {
        const { data: profile } = await supabase
          .from('registeredaccounts')
          .select('business, organization')
          .eq('user_id', user.id)
          .maybeSingle();

        let nextRole: 'business' | 'organization' | 'individual' = 'individual';
        if (profile?.business) nextRole = 'business';
        else if (profile?.organization) nextRole = 'organization';
        setUserRole(nextRole);
        if (typeof window !== 'undefined') {
          localStorage.setItem('userType', nextRole);
        }
      }
    };

    checkSession();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const close = () => setIsOpen(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userType');
    }
    setIsOpen(false);
    router.push('/login');
  };

  const onDashboardClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    close();
    if (!loggedIn) {
      e.preventDefault();
      router.push('/login');
    }
  };

  return (
    <>
      <div
        className={[
          'fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-[3px] transition-[opacity,visibility] duration-300 ease-out',
          isOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none',
        ].join(' ')}
        onClick={close}
        aria-hidden={!isOpen}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t(effectiveLang, 'menu')}
        className={[
          'fixed inset-y-0 right-0 z-[70] flex w-[min(100vw-1rem,20rem)] sm:w-[22rem] max-w-full flex-col',
          'rounded-l-[1.75rem] border-l border-slate-200/90 bg-white shadow-[-12px_0_48px_-12px_rgba(15,23,42,0.18)] dark:border-slate-700/90 dark:bg-slate-950',
          'pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]',
          'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none',
        ].join(' ')}
      >
        <div className="relative overflow-hidden px-4 pb-5 pt-2.5">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-rose-600 via-rose-700 to-rose-900 dark:from-rose-700 dark:via-rose-800 dark:to-slate-900 opacity-[0.97]"
            aria-hidden
          />
          <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-amber-400/20 blur-2xl" aria-hidden />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0 pt-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-100/90">Hanar</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">{t(effectiveLang, 'menu')}</h2>
            </div>
            <button
              type="button"
              onClick={close}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80"
              aria-label="Close Menu"
            >
              <FaTimes className="text-lg" />
            </button>
          </div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-4 py-4">
          <Link
            href={dashboardHref}
            onClick={onDashboardClick}
            className={[
              'group flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all duration-200 border border-transparent',
              isDashboardActive
                ? 'bg-rose-500/[0.12] dark:bg-rose-400/15 border-rose-300/40 dark:border-rose-500/35 shadow-sm'
                : 'bg-slate-50/90 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:border-slate-200/80 dark:hover:border-slate-600/60 active:scale-[0.99]',
            ].join(' ')}
          >
            <span
              className={[
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm transition-colors',
                isDashboardActive
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25 dark:bg-rose-500'
                  : 'bg-white text-rose-600 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:text-rose-400 dark:ring-slate-600/50 group-hover:text-rose-700 dark:group-hover:text-rose-300',
              ].join(' ')}
            >
              <FaThLarge />
            </span>
            <span
              className={[
                'min-w-0 flex-1 text-sm font-medium tracking-tight',
                isDashboardActive ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-100',
              ].join(' ')}
            >
              {t(effectiveLang, 'dashboard')}
            </span>
            <FaChevronRight
              className={[
                'mr-0.5 shrink-0 text-[10px] transition-transform duration-200',
                isDashboardActive
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 group-hover:text-slate-400 dark:group-hover:text-slate-500',
              ].join(' ')}
              aria-hidden
            />
          </Link>

          <div className="my-3 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-700" />

          <MenuRow
            href="/faq"
            icon={<FaQuestionCircle />}
            label={t(effectiveLang, 'faq')}
            active={pathname === '/faq' || pathname.startsWith('/faq/')}
            onNavigate={close}
          />
          <MenuRow
            href="/contact"
            icon={<FaPhone />}
            label={t(effectiveLang, 'contact')}
            active={pathname === '/contact'}
            onNavigate={close}
          />
          <MenuRow
            href="/settings"
            icon={<FaCog />}
            label={t(effectiveLang, 'settings')}
            active={pathname.startsWith('/settings')}
            onNavigate={close}
          />

          <div className="mt-3 rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 dark:border-slate-700/80 dark:bg-slate-900/50">
            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <FaLanguage className="text-xs text-rose-600 dark:text-rose-400" aria-hidden />
              {t(effectiveLang, 'Language')}
            </label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="mt-2 w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-xs font-medium text-slate-800 shadow-sm transition focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-rose-500 dark:focus:ring-rose-500/25"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.65rem center',
                backgroundSize: '0.75rem',
              }}
            >
              {supportedLanguages.map(({ code, name, emoji }) => (
                <option key={code} value={code}>
                  {emoji} {name}
                </option>
              ))}
            </select>
          </div>
        </nav>

        <div className="shrink-0 border-t border-slate-200/80 px-4 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              close();
              if (loggedIn) handleLogout();
              else router.push('/login');
            }}
            className={[
              'flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950',
              loggedIn
                ? 'border-2 border-slate-200 bg-white text-slate-800 hover:bg-slate-50 focus-visible:ring-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'
                : 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-lg shadow-rose-600/25 hover:from-rose-500 hover:to-rose-600 focus-visible:ring-rose-500',
            ].join(' ')}
          >
            {loggedIn ? (
              <>
                <FaSignOutAlt className="text-sm opacity-80" />
                {t(effectiveLang, 'logout')}
              </>
            ) : (
              <>
                <FaSignInAlt className="text-sm opacity-90" />
                {t(effectiveLang, 'login')}
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
