'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { AdminConfirmProvider } from '@/components/AdminConfirmContext';
import { REPORT_INBOX_NAV } from '@/lib/admin/reportTypes';

type AdminNavLink = {
  kind: 'link';
  label: string;
  path: string;
  countKey?: string;
  indent?: boolean;
};

type AdminNavHeading = {
  kind: 'heading';
  label: string;
  countKey?: string;
};

type AdminNavSubgroup = {
  kind: 'subgroup';
  key: string;
  label: string;
  countKey?: string;
  items: AdminNavLink[];
};

type AdminNavEntry = AdminNavLink | AdminNavHeading | AdminNavSubgroup;
type AdminNavGroup = { key: string; title: string; items: AdminNavEntry[]; countKey?: 'inbox' };

function navLink(label: string, path: string): AdminNavLink {
  return { kind: 'link', label, path };
}

const INBOX_NAV_ITEMS: AdminNavEntry[] = [
  { kind: 'link', label: 'Business Claims', path: '/admin/inbox/business-claims', countKey: 'businessClaims' },
  { kind: 'link', label: 'Contact Us', path: '/admin/inbox/contact', countKey: 'contactUs' },
  {
    kind: 'subgroup',
    key: 'reports',
    label: 'Reports',
    countKey: 'reports',
    items: [
      { kind: 'link', label: 'All reports', path: '/admin/inbox/reports', countKey: 'reports', indent: true },
      ...REPORT_INBOX_NAV.map(
        (entry): AdminNavLink => ({
          kind: 'link',
          label: entry.navLabel,
          path: `/admin/inbox/reports/${entry.slug}`,
          countKey: `reportsTotal:${entry.slug}`,
          indent: true,
        })
      ),
    ],
  },
];

const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    key: 'inbox',
    title: 'Inbox',
    countKey: 'inbox',
    items: INBOX_NAV_ITEMS,
  },
  {
    key: 'overview',
    title: 'Overview',
    items: [navLink('Dashboard', '/admin/dashboard'), navLink('Owner Panel', '/admin/owner')],
  },
  {
    key: 'accounts',
    title: 'Accounts & Access',
    items: [
      navLink('Admins', '/admin/admins'),
      navLink('Organizations', '/admin/organizations'),
      navLink('Create Business / Org', '/admin/create'),
      navLink('Business Approvals', '/admin/approvals'),
    ],
  },
  {
    key: 'notifications',
    title: 'Notifications & Email',
    items: [
      navLink('Send Notifications', '/admin/notifications'),
      navLink('Notification Requests', '/admin/notification-requests'),
      navLink('Send Emails', '/admin/send-emails'),
      navLink('Custom Message', '/admin/send-emails/custom'),
      navLink('Login + OTP', '/admin/send-emails/login'),
    ],
  },
  {
    key: 'promotions',
    title: 'Promotions & Banners',
    items: [
      navLink('Feed Banners', '/admin/feed-banners'),
      navLink('Promotion Requests', '/admin/promotion-requests'),
      navLink('Create Promotion', '/admin/create-promotion'),
    ],
  },
  {
    key: 'marketplace',
    title: 'Marketplace',
    items: [
      navLink('Marketplace Items', '/admin/marketplace-items'),
      navLink('Marketplace Insights', '/admin/marketplace-insights'),
      navLink('Seed Marketplace', '/admin/seed-marketplace'),
    ],
  },
  {
    key: 'community',
    title: 'Community & Moderation',
    items: [
      navLink('Community Moderation', '/admin/community-moderation'),
      navLink('Moderation', '/admin/moderation'),
      navLink('Seed Community', '/admin/seed-community'),
    ],
  },
];

type InboxCounts = {
  pendingEmailClaims: number;
  pendingContactForm: number;
  contactUs: number;
  businessClaims: number;
  reports: number;
  reportsByType: Record<string, number>;
  reportsByTypeTotal: Record<string, number>;
  reportsTotal: number;
  inbox: number;
};

function CountBadge({
  count,
  unread,
  active,
}: {
  count: number;
  unread?: number;
  active?: boolean;
}) {
  if (count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);
  const hasUnread = (unread ?? 0) > 0;
  return (
    <span
      className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none min-w-[1.25rem] text-center ${
        hasUnread
          ? active
            ? 'bg-amber-300 text-amber-950'
            : 'bg-amber-400 text-amber-950'
          : active
            ? 'bg-slate-500 text-white'
            : 'bg-slate-200 text-slate-700'
      }`}
      aria-label={`${label} received${hasUnread ? `, ${unread} unread` : ''}`}
      title={hasUnread ? `${count} received · ${unread} unread` : `${count} received`}
    >
      {label}
    </span>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ADMIN_NAV_GROUPS.map((group) => [group.key, false]))
  );
  const [inboxCounts, setInboxCounts] = useState<InboxCounts | null>(null);
  const [openSubgroups, setOpenSubgroups] = useState<Record<string, boolean>>({ reports: false });
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
          credentials: 'include',
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
        } else if (result?.requiresPin || result?.requires2fa) {
          router.push('/admin-login');
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
    setOpenGroups(
      Object.fromEntries(
        ADMIN_NAV_GROUPS.map((group) => [
          group.key,
          group.items.some((item) => {
            if (item.kind === 'link') {
              return pathname === item.path || pathname.startsWith(`${item.path}/`);
            }
            if (item.kind === 'subgroup') {
              return item.items.some(
                (child) => pathname === child.path || pathname.startsWith(`${child.path}/`)
              );
            }
            return false;
          }),
        ])
      )
    );
    if (pathname === '/admin/inbox/reports' || pathname.startsWith('/admin/inbox/reports/')) {
      setOpenSubgroups((prev) => ({ ...prev, reports: true }));
    }
  }, [pathname]);

  useEffect(() => {
    if (!authorized) return;

    let cancelled = false;

    const fetchInboxCounts = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const res = await fetch('/api/admin/inbox/counts', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as InboxCounts;
        if (!cancelled) setInboxCounts(data);
      } catch {
        // ignore sidebar count errors
      }
    };

    void fetchInboxCounts();
    const interval = window.setInterval(fetchInboxCounts, 60_000);

    const onRefresh = () => {
      void fetchInboxCounts();
    };
    window.addEventListener('admin-inbox-counts-refresh', onRefresh);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('admin-inbox-counts-refresh', onRefresh);
    };
  }, [authorized, pathname]);

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

  const toggleSubgroup = (key: string) =>
    setOpenSubgroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const getCount = (key?: string) => {
    if (!key || !inboxCounts) return 0;
    if (key === 'inbox') {
      return (
        (inboxCounts.businessClaims ?? 0) +
        (inboxCounts.contactUs ?? 0) +
        (inboxCounts.reportsTotal ?? 0)
      );
    }
    if (key === 'businessClaims') return inboxCounts.businessClaims;
    if (key === 'contactUs') return inboxCounts.contactUs;
    if (key === 'reports') return inboxCounts.reportsTotal ?? 0;
    if (key.startsWith('reportsTotal:')) {
      const type = key.slice('reportsTotal:'.length);
      return inboxCounts.reportsByTypeTotal?.[type] ?? 0;
    }
    if (key.startsWith('reports:')) {
      const type = key.slice('reports:'.length);
      return inboxCounts.reportsByType?.[type] ?? 0;
    }
    return 0;
  };

  const getUnreadCount = (key?: string) => {
    if (!key || !inboxCounts) return 0;
    if (key === 'businessClaims') return inboxCounts.businessClaims;
    if (key === 'contactUs') return inboxCounts.contactUs;
    if (key === 'reports') return inboxCounts.reports;
    if (key.startsWith('reportsTotal:')) {
      const type = key.slice('reportsTotal:'.length);
      return inboxCounts.reportsByType?.[type] ?? 0;
    }
    return 0;
  };

  const isNavLinkActive = (path: string) => {
    if (path === '/admin/inbox/reports') {
      return pathname === '/admin/inbox/reports';
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const isSubgroupActive = (items: AdminNavLink[]) =>
    items.some((item) => isNavLinkActive(item.path));

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
          const groupHasActive = group.items.some((item) => {
            if (item.kind === 'link') return isNavLinkActive(item.path);
            if (item.kind === 'subgroup') return isSubgroupActive(item.items);
            return false;
          });

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
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span>{group.title}</span>
                  <CountBadge
                    count={getCount(group.countKey)}
                    unread={
                      group.countKey === 'inbox'
                        ? (inboxCounts?.businessClaims ?? 0) +
                          (inboxCounts?.contactUs ?? 0) +
                          (inboxCounts?.reports ?? 0)
                        : undefined
                    }
                    active={groupHasActive}
                  />
                </span>
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
                    if (item.kind === 'subgroup') {
                      const isSubgroupOpen = openSubgroups[item.key] ?? false;
                      const subgroupActive = isSubgroupActive(item.items);
                      return (
                        <div key={item.key} className="mb-0.5">
                          <button
                            type="button"
                            onClick={() => toggleSubgroup(item.key)}
                            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors min-h-[40px] ${
                              subgroupActive
                                ? 'bg-slate-100 text-slate-900'
                                : 'text-slate-600 hover:bg-slate-50 active:bg-slate-100'
                            }`}
                            aria-expanded={isSubgroupOpen}
                          >
                            <span className="min-w-0 flex-1 text-left">{item.label}</span>
                            <CountBadge
                              count={getCount(item.countKey)}
                              unread={getUnreadCount(item.countKey)}
                              active={subgroupActive}
                            />
                            <svg
                              className={`h-4 w-4 shrink-0 transition-transform ${isSubgroupOpen ? 'rotate-180' : 'rotate-0'}`}
                              viewBox="0 0 20 20"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              aria-hidden
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8l5 5 5-5" />
                            </svg>
                          </button>
                          {isSubgroupOpen ? (
                            <div className="mt-0.5">
                              {item.items.map((child) => {
                                const isActive = isNavLinkActive(child.path);
                                return (
                                  <Link
                                    key={child.path}
                                    href={child.path}
                                    onClick={closeMenu}
                                    className={`mb-0.5 flex items-center gap-2 rounded-lg py-2 pl-5 pr-2.5 text-sm font-medium transition-colors min-h-[36px] ${
                                      isActive
                                        ? 'bg-slate-900 text-white'
                                        : 'text-slate-600 hover:bg-slate-50 active:bg-slate-100'
                                    }`}
                                  >
                                    <span className="min-w-0 flex-1">{child.label}</span>
                                    <CountBadge
                                      count={getCount(child.countKey)}
                                      unread={getUnreadCount(child.countKey)}
                                      active={isActive}
                                    />
                                  </Link>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    }

                    if (item.kind === 'heading') {
                      return (
                        <div
                          key={`heading-${item.label}`}
                          className="mb-0.5 mt-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 first:mt-0"
                        >
                          <span className="min-w-0 flex-1">{item.label}</span>
                          <CountBadge count={getCount(item.countKey)} unread={getUnreadCount(item.countKey)} />
                        </div>
                      );
                    }

                    const isActive = isNavLinkActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={closeMenu}
                        className={`mb-0.5 flex items-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors min-h-[40px] ${
                          item.indent ? 'pl-5 pr-2.5' : 'px-2.5'
                        } ${
                          isActive
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:bg-slate-50 active:bg-slate-100'
                        }`}
                      >
                        <span className="min-w-0 flex-1">{item.label}</span>
                        <CountBadge
                          count={getCount(item.countKey)}
                          unread={getUnreadCount(item.countKey)}
                          active={isActive}
                        />
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
