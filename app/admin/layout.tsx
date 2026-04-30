'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { AdminConfirmProvider } from '@/components/AdminConfirmContext';

type AdminNavItem = { label: string; path: string };
type AdminNavGroup = { key: string; title: string; items: AdminNavItem[] };

const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    key: 'overview',
    title: 'Overview',
    items: [
      { label: 'Dashboard', path: '/admin/dashboard' },
      { label: 'Owner Panel', path: '/admin/owner' },
    ],
  },
  {
    key: 'accounts',
    title: 'Accounts & Access',
    items: [
      { label: 'Admins', path: '/admin/admins' },
      { label: 'Organizations', path: '/admin/organizations' },
      { label: 'Create Business / Org', path: '/admin/create' },
      { label: 'Business Approvals', path: '/admin/approvals' },
    ],
  },
  {
    key: 'notifications',
    title: 'Notifications & Email',
    items: [
      { label: 'Send Notifications', path: '/admin/notifications' },
      { label: 'Notification Requests', path: '/admin/notification-requests' },
      { label: 'Send Emails', path: '/admin/send-emails' },
      { label: 'Custom Message', path: '/admin/send-emails/custom' },
      { label: 'Login + OTP', path: '/admin/send-emails/login' },
    ],
  },
  {
    key: 'promotions',
    title: 'Promotions & Banners',
    items: [
      { label: 'Feed Banners', path: '/admin/feed-banners' },
      { label: 'Promotion Requests', path: '/admin/promotion-requests' },
      { label: 'Create Promotion', path: '/admin/create-promotion' },
    ],
  },
  {
    key: 'marketplace',
    title: 'Marketplace',
    items: [
      { label: 'Marketplace Items', path: '/admin/marketplace-items' },
      { label: 'Marketplace Insights', path: '/admin/marketplace-insights' },
      { label: 'Seed Marketplace', path: '/admin/seed-marketplace' },
    ],
  },
  {
    key: 'community',
    title: 'Community & Moderation',
    items: [
      { label: 'Community Moderation', path: '/admin/community-moderation' },
      { label: 'Moderation', path: '/admin/moderation' },
      { label: 'Reports', path: '/admin/reports' },
      { label: 'Seed Community', path: '/admin/seed-community' },
      { label: 'Contact to review', path: '/admin/contact' },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ADMIN_NAV_GROUPS.map((group) => [group.key, false]))
  );
  const router = useRouter();
  const pathname = usePathname() ?? '';

  useEffect(() => {
    const checkAdminSession = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user || !user.email) {
        router.push('/admin-login');
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          router.push('/admin-login');
          return;
        }
        const response = await fetch('/api/check-admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });
        const result = await response.json();

        if (response.ok && result.allowed) {
          setAuthorized(true);
          setAdminRole(result.role ?? null);
        } else {
          router.push('/admin-login');
        }
      } catch {
        router.push('/unauthorized');
      } finally {
        setChecking(false);
      }
    };

    checkAdminSession();
  }, [router]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenGroups(Object.fromEntries(ADMIN_NAV_GROUPS.map((group) => [group.key, false])));
  }, [pathname]);

  useEffect(() => {
    if (!authorized) return;
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen, authorized]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-600 font-medium">Checking admin access...</p>
        </div>
      </div>
    );
  }

  if (!authorized) return null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin-login');
  };

  const closeMenu = () => setMobileMenuOpen(false);
  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const navLinks = (
    <>
      <div className="p-4 border-b border-slate-200">
        <Link href="/admin/dashboard" className="block" onClick={closeMenu}>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">Admin Panel</h1>
          <p className="text-xs text-slate-500 mt-0.5">Hanar</p>
          {adminRole === 'business' && (
            <span className="inline-block mt-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
              Business account
            </span>
          )}
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {ADMIN_NAV_GROUPS.map((group) => {
          const isGroupOpen = openGroups[group.key] ?? true;
          const groupHasActive = group.items.some((item) => pathname === item.path);

          return (
            <section key={group.key} className="rounded-xl border border-slate-200/80 bg-white">
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold tracking-wide transition-colors ${
                  groupHasActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 active:bg-slate-100'
                }`}
                aria-expanded={isGroupOpen}
                aria-controls={`admin-group-${group.key}`}
              >
                <span>{group.title}</span>
                <svg
                  className={`h-4 w-4 transition-transform ${isGroupOpen ? 'rotate-180' : 'rotate-0'}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8l5 5 5-5" />
                </svg>
              </button>
              {isGroupOpen ? (
                <div id={`admin-group-${group.key}`} className="px-1.5 pb-1.5">
                  {group.items.map((item) => {
                    const isActive = pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={closeMenu}
                        className={`mb-0.5 block rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors min-h-[40px] ${
                          isActive
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:bg-slate-50 active:bg-slate-100'
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-200">
        <button
          type="button"
          onClick={() => {
            closeMenu();
            handleLogout();
          }}
          className="w-full px-3 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors text-left min-h-[44px] flex items-center touch-manipulation"
        >
          Log out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Mobile: top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center gap-3 h-14 px-4 bg-white border-b border-slate-200 shadow-sm">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex items-center justify-center w-11 h-11 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 active:bg-slate-200 touch-manipulation"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link href="/admin/dashboard" className="font-bold text-slate-800 truncate flex-1 min-w-0">
          Admin Panel
        </Link>
      </header>

      {/* Mobile: backdrop */}
      {mobileMenuOpen && (
        <button
          type="button"
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          aria-label="Close menu"
          onClick={closeMenu}
        />
      )}

      {/* Sidebar: drawer on mobile, static on desktop */}
      <aside
        className={`
          flex flex-col bg-white border-r border-slate-200 shadow-sm
          w-72 max-w-[85vw] md:w-60 md:max-w-none
          fixed md:static top-0 left-0 h-full z-50 md:z-auto
          transform transition-transform duration-200 ease-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {navLinks}
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-auto pt-14 md:pt-0">
        <AdminConfirmProvider>
          <div className="p-4 sm:p-6 lg:p-8 pb-8 min-h-screen md:min-h-0">
            {children}
          </div>
        </AdminConfirmProvider>
      </main>
    </div>
  );
}
