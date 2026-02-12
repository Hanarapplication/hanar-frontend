'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

const ADMIN_NAV = [
  { label: 'Dashboard', path: '/admin/dashboard' },
  { label: 'Business Approvals', path: '/admin/approvals' },
  { label: 'Organizations', path: '/admin/organizations' },
  { label: 'Create Business / Org', path: '/admin/create' },
  { label: 'Send Emails', path: '/admin/send-emails' },
  { label: 'Custom Message', path: '/admin/send-emails/custom' },
  { label: 'Login + OTP', path: '/admin/send-emails/login' },
  { label: 'Notification Requests', path: '/admin/notification-requests' },
  { label: 'Send Notifications', path: '/admin/notifications' },
  { label: 'Feed Banners', path: '/admin/feed-banners' },
  { label: 'Promotion Requests', path: '/admin/promotion-requests' },
  { label: 'Marketplace Insights', path: '/admin/marketplace-insights' },
  { label: 'Community Moderation', path: '/admin/community-moderation' },
  { label: 'Moderation', path: '/admin/moderation' },
  { label: 'Contact to review', path: '/admin/contact' },
  { label: 'Owner Panel', path: '/admin/owner' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const navLinks = (
    <>
      <div className="p-4 border-b border-slate-200">
        <Link href="/admin/dashboard" className="block" onClick={closeMenu}>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">Admin Panel</h1>
          <p className="text-xs text-slate-500 mt-0.5">Hanar</p>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {ADMIN_NAV.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={closeMenu}
              className={`block px-3 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px] flex items-center touch-manipulation ${
                isActive
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 active:bg-slate-100'
              }`}
            >
              {item.label}
            </Link>
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
        <div className="p-4 sm:p-6 lg:p-8 pb-8 min-h-screen md:min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
}
