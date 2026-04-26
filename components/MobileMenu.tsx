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
        'group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all duration-200 active:scale-[0.99]',
        active
          ? 'border-blue-200 bg-blue-50 shadow-sm dark:border-blue-800/50 dark:bg-blue-900/20'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm transition-colors',
          active
            ? 'border-blue-200 bg-blue-600 text-white shadow-sm dark:border-blue-700 dark:bg-blue-500'
            : 'border-slate-200 bg-slate-100 text-slate-700 group-hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:group-hover:bg-slate-700',
        ].join(' ')}
      >
        {icon}
      </span>
      <span
        className={[
          'min-w-0 flex-1 text-sm font-medium tracking-tight',
          active ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200',
        ].join(' ')}
      >
        {label}
      </span>
      <FaChevronRight
        className={[
          'mr-0.5 shrink-0 text-[10px] transition-transform duration-200',
          active
            ? 'translate-x-0 text-slate-500 dark:text-slate-300'
            : 'text-slate-400 group-hover:translate-x-0.5 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300',
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
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    return () => {
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
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
          'fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-[3px] transition-[opacity,visibility] duration-300 ease-out cursor-pointer select-none [-webkit-tap-highlight-color:transparent]',
          isOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none',
        ].join(' ')}
        onPointerDown={(e) => {
          if (!isOpen) return;
          e.preventDefault();
          close();
        }}
        role="presentation"
        aria-hidden={!isOpen}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t(effectiveLang, 'menu')}
        className={[
          'fixed inset-y-0 left-0 z-[70] flex w-[min(100vw-1rem,20rem)] max-w-full flex-col rounded-r-[1.75rem] border-r border-white/20 shadow-[12px_0_48px_-12px_rgba(0,0,0,0.45)] sm:w-[22rem]',
          'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
          'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          'bg-white dark:bg-slate-900',
          isOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none',
        ].join(' ')}
      >
        <div className="shrink-0 border-b border-slate-200 bg-gradient-to-r from-[#2b0710] via-[#4a0a14] to-[#0b2a66] px-4 pb-5 pt-[max(0.75rem,env(safe-area-inset-top))] dark:border-slate-700">
          <div className="flex items-center justify-between gap-3 pt-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">Hanar</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-black/20 text-white shadow-sm transition hover:bg-black/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              aria-label={t(effectiveLang, 'Close menu')}
            >
              <FaTimes className="text-lg" />
            </button>
          </div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain bg-white px-4 py-4 dark:bg-slate-900">
          <Link
            href={dashboardHref}
            onClick={onDashboardClick}
            className={[
              'group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all duration-200 active:scale-[0.99]',
              isDashboardActive
                ? 'border-blue-200 bg-blue-50 shadow-sm dark:border-blue-800/50 dark:bg-blue-900/20'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800',
            ].join(' ')}
          >
            <span
              className={[
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm transition-colors',
                isDashboardActive
                  ? 'border-blue-200 bg-blue-600 text-white shadow-sm dark:border-blue-700 dark:bg-blue-500'
                  : 'border-slate-200 bg-slate-100 text-slate-700 group-hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:group-hover:bg-slate-700',
              ].join(' ')}
            >
              <FaThLarge />
            </span>
            <span
              className={[
                'min-w-0 flex-1 text-sm font-medium tracking-tight',
                isDashboardActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200',
              ].join(' ')}
            >
              {t(effectiveLang, 'dashboard')}
            </span>
            <FaChevronRight
              className={[
                'mr-0.5 shrink-0 text-[10px] transition-transform duration-200',
                isDashboardActive
                  ? 'text-slate-500 dark:text-slate-300'
                  : 'text-slate-400 group-hover:translate-x-0.5 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300',
              ].join(' ')}
              aria-hidden
            />
          </Link>

          <div className="my-3 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-700" />

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

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              <FaLanguage className="text-xs text-slate-700 dark:text-slate-200" aria-hidden />
              {t(effectiveLang, 'Language')}
            </label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="mt-2 w-full cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-xs font-medium text-slate-800 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/35 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
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

        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => {
              close();
              if (loggedIn) handleLogout();
              else router.push('/login');
            }}
            className={[
              'flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
              loggedIn
                ? 'border border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200 focus-visible:ring-slate-400/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
                : 'bg-gradient-to-r from-[#2b0710] via-[#4a0a14] to-[#0b2a66] text-white shadow-sm hover:brightness-110 focus-visible:ring-white/60',
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
