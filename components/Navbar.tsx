'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, MessageCircle, Store, ShoppingCart, CircleUserRound } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Avatar } from '@/components/Avatar';
import { writeSavedSearchRadiusMiles } from '@/lib/geoDistance';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

const navLineIconClass = 'h-[1.4rem] w-[1.4rem]';

 type NavbarNotificationRow = {
  id: string;
  title: string;
  body: string;
  url?: string | null;
  created_at: string;
  read_at?: string | null;
  data?: {
    business_id?: string;
  };
};

export default function Navbar({ hidden = false }: { hidden?: boolean }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  /** e.g. /marketplace/individual-abc — not /marketplace, /post, or /edit/... */
  const isMarketplaceItemDetailPage = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts[0] !== 'marketplace' || parts.length !== 2) return false;
    if (parts[1] === 'post' || parts[1] === 'edit') return false;
    return true;
  }, [pathname]);
  useEffect(() => {
    if (isMarketplaceItemDetailPage) {
      setNotificationsOpen(false);
    }
  }, [isMarketplaceItemDetailPage]);
  const { effectiveLang } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<NavbarNotificationRow[]>([]);
  const [incomingMessageToast, setIncomingMessageToast] = useState<{ messageId: string; senderId: string; label: string } | null>(null);
  const [incomingToastVisible, setIncomingToastVisible] = useState(false);
  const [dashboardIdentity, setDashboardIdentity] = useState<{ loggedIn: boolean; avatarUrl: string | null }>({
    loggedIn: false,
    avatarUrl: null,
  });
  const notificationsPanelRef = useRef<HTMLDivElement | null>(null);
  const notificationsBellRef = useRef<HTMLButtonElement | null>(null);
  const incomingToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitializedIncomingRef = useRef(false);
  const lastIncomingMessageIdRef = useRef<string | null>(null);
  const shownIncomingToastIdsRef = useRef<Set<string>>(new Set());

  const normalizeAvatarUrl = useCallback((value?: string | null, buckets: string[] = []) => {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (trimmed.startsWith('/storage/v1/object/public/')) return base ? `${base}${trimmed}` : trimmed;
    if (trimmed.startsWith('storage/v1/object/public/')) return base ? `${base}/${trimmed}` : `/${trimmed}`;
    if (trimmed.startsWith('/')) return trimmed;
    for (const bucket of buckets) {
      const normalizedPath = trimmed.startsWith(`${bucket}/`) ? trimmed.slice(bucket.length + 1) : trimmed;
      if (base) return `${base}/storage/v1/object/public/${bucket}/${normalizedPath}`;
    }
    return trimmed;
  }, []);

  const fetchOwnedBusinessIds = useCallback(async (userId: string) => {
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', userId);
    if (error) return new Set<string>();
    return new Set((businesses || []).map((row) => String((row as any).id)));
  }, []);

  const toAtLabel = useCallback((value: string) => {
    const normalized = String(value || '').trim().replace(/\s+/g, '_');
    if (!normalized) return '@user';
    return normalized.startsWith('@') ? normalized : `@${normalized}`;
  }, []);

  const resolveSenderHandle = useCallback(async (senderId: string) => {
    const [profileRes, registeredRes, orgRes, bizRes] = await Promise.all([
      supabase.from('profiles').select('username').eq('id', senderId).maybeSingle(),
      supabase.from('registeredaccounts').select('username, full_name').eq('user_id', senderId).maybeSingle(),
      supabase.from('organizations').select('username, full_name').eq('user_id', senderId).maybeSingle(),
      supabase.from('businesses').select('business_name').eq('owner_id', senderId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const displayName =
      bizRes.data?.business_name ||
      orgRes.data?.full_name ||
      registeredRes.data?.full_name;
    if (displayName) return toAtLabel(displayName);

    const username = orgRes.data?.username || profileRes.data?.username || registeredRes.data?.username;
    if (username) return toAtLabel(username);

    return toAtLabel(`user_${senderId.slice(0, 8)}`);
  }, [toAtLabel]);

  const showIncomingMessageToast = useCallback((messageId: string, senderId: string, label: string) => {
    if (shownIncomingToastIdsRef.current.has(messageId)) return;
    shownIncomingToastIdsRef.current.add(messageId);
    setIncomingMessageToast({ messageId, senderId, label });
    setIncomingToastVisible(true);
    if (incomingToastTimerRef.current) {
      clearTimeout(incomingToastTimerRef.current);
    }
    incomingToastTimerRef.current = setTimeout(() => {
      setIncomingToastVisible(false);
    }, 4200);
  }, []);

  const persistLocation = useCallback(async (
    lat: number,
    lon: number,
    meta?: { city?: string | null; state?: string | null; zip?: string | null; source?: string }
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || '';
      await fetch('/api/user-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          lat,
          lng: lon,
          city: meta?.city ?? null,
          state: meta?.state ?? null,
          zip: meta?.zip ?? null,
          source: meta?.source ?? null,
        }),
      });
    } catch {
      // Ignore
    }
  }, []);

  /** Keep shared location prefs in sync when Set on Businesses/Marketplace/Location prompt (no header UI). */
  useEffect(() => {
    const handleLocationUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail as { label?: string; radiusMiles?: number } | undefined;
      if (detail?.label) localStorage.setItem('userLocationLabel', detail.label);
      if (detail?.radiusMiles != null) writeSavedSearchRadiusMiles(detail.radiusMiles);
    };
    window.addEventListener('location:updated', handleLocationUpdated as EventListener);
    return () => window.removeEventListener('location:updated', handleLocationUpdated as EventListener);
  }, []);

  useEffect(() => {
    const syncStoredLocationIfLoggedIn = async () => {
      const coordsRaw = localStorage.getItem('userCoords');
      if (!coordsRaw) return;
      try {
        const { lat, lon } = JSON.parse(coordsRaw);
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) persistLocation(lat, lon, { source: 'gps' });
      } catch {}
    };
    syncStoredLocationIfLoggedIn();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => { syncStoredLocationIfLoggedIn(); });
    return () => authListener?.subscription?.unsubscribe();
  }, [persistLocation]);

  useEffect(() => {
    let cancelled = false;
    const hydrateDashboardIdentity = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setDashboardIdentity({ loggedIn: false, avatarUrl: null });
        return;
      }
      const [profileRes, orgRes, businessRes] = await Promise.all([
        supabase.from('profiles').select('profile_pic_url').eq('id', user.id).maybeSingle(),
        supabase.from('organizations').select('logo_url').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('businesses')
          .select('logo_url, created_at')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      const avatarUrl =
        normalizeAvatarUrl(profileRes.data?.profile_pic_url, ['avatars']) ||
        normalizeAvatarUrl(orgRes.data?.logo_url, ['organizations', 'organization-uploads']) ||
        normalizeAvatarUrl(businessRes.data?.logo_url, ['business-uploads']) ||
        null;
      setDashboardIdentity({ loggedIn: true, avatarUrl });
    };

    hydrateDashboardIdentity();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      hydrateDashboardIdentity();
    });

    return () => {
      cancelled = true;
      authListener?.subscription?.unsubscribe();
    };
  }, [normalizeAvatarUrl]);

  const loadNotificationItems = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setNotifications([]);
        return;
      }
      const ownedIds = await fetchOwnedBusinessIds(user.id);
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, body, url, created_at, read_at, data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) {
        setNotifications([]);
        return;
      }
      const rows = (data || []) as NavbarNotificationRow[];
      setNotifications(
        rows.filter((row) => {
          const businessId = row.data?.business_id;
          if (businessId && ownedIds.has(String(businessId))) return false;
          return true;
        })
      );
    } finally {
      setNotificationsLoading(false);
    }
  }, [fetchOwnedBusinessIds]);

  useEffect(() => {
    const loadUnreadCount = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUnreadCount(0);
        return;
      }

      const ownedIds = await fetchOwnedBusinessIds(user.id);

      const { data, error } = await supabase
        .from('notifications')
        .select('id, data')
        .eq('user_id', user.id)
        .is('read_at', null);

      if (error) {
        setUnreadCount(0);
        return;
      }

      const rows = (data || []) as Array<{ id: string; data?: { business_id?: string } }>;
      const visible = rows.filter((row) => {
        const businessId = row.data?.business_id;
        if (businessId && ownedIds.has(String(businessId))) return false;
        return true;
      });
      setUnreadCount(visible.length);
    };

    loadUnreadCount();
    const handler = () => loadUnreadCount();
    window.addEventListener('notifications:updated', handler);
    let activeChannel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    const initRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      activeChannel = supabase
        .channel(`navbar-notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadUnreadCount();
          }
        )
        .subscribe();
    };
    initRealtime();
    return () => {
      cancelled = true;
      window.removeEventListener('notifications:updated', handler);
      if (activeChannel) supabase.removeChannel(activeChannel);
    };
  }, [fetchOwnedBusinessIds]);

  useEffect(() => {
    const loadUnreadMessages = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setUnreadMessageCount(0);
        return;
      }
      const { count } = await supabase
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', user.id)
        .is('read_at', null);
      setUnreadMessageCount(count || 0);
    };

    const checkLatestIncomingMessage = async (userId: string) => {
      const { data } = await supabase
        .from('direct_messages')
        .select('id, sender_user_id')
        .eq('recipient_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data?.id || !data?.sender_user_id) return;
      const messageId = String(data.id);
      const senderId = String(data.sender_user_id);
      if (!hasInitializedIncomingRef.current) {
        hasInitializedIncomingRef.current = true;
        lastIncomingMessageIdRef.current = messageId;
        return;
      }
      if (lastIncomingMessageIdRef.current === messageId) return;
      lastIncomingMessageIdRef.current = messageId;
      const senderHandle = await resolveSenderHandle(senderId);
      showIncomingMessageToast(messageId, senderId, senderHandle);
    };

    loadUnreadMessages();

    const onMessagesUpdated = () => loadUnreadMessages();
    window.addEventListener('messages:updated', onMessagesUpdated);

    let activeChannel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    const initRealtime = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      activeChannel = supabase
        .channel(`navbar-messages-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'direct_messages',
            filter: `recipient_user_id=eq.${user.id}`,
          },
          async (payload: any) => {
            loadUnreadMessages();
            if (payload?.eventType === 'INSERT') {
              const messageId = String(payload?.new?.id || '');
              const senderId = String(payload?.new?.sender_user_id || '');
              const senderLabelFromMessage = String(payload?.new?.sender_label || '').trim();
              if (messageId && senderId && senderId !== user.id) {
                lastIncomingMessageIdRef.current = messageId;
                hasInitializedIncomingRef.current = true;
                const senderHandle = senderLabelFromMessage
                  ? toAtLabel(senderLabelFromMessage)
                  : await resolveSenderHandle(senderId);
                showIncomingMessageToast(messageId, senderId, senderHandle);
              }
            }
          }
        )
        .subscribe();

      await checkLatestIncomingMessage(user.id);

      const pollingInterval = window.setInterval(() => {
        loadUnreadMessages();
        checkLatestIncomingMessage(user.id);
      }, 5000);

      return pollingInterval;
    };
    let pollingInterval: number | null = null;
    initRealtime().then((intervalId) => {
      pollingInterval = intervalId ?? null;
    });

    return () => {
      cancelled = true;
      window.removeEventListener('messages:updated', onMessagesUpdated);
      if (activeChannel) supabase.removeChannel(activeChannel);
      if (pollingInterval) window.clearInterval(pollingInterval);
    };
  }, [resolveSenderHandle, showIncomingMessageToast, toAtLabel]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      const insidePanel = !!notificationsPanelRef.current && !!target && notificationsPanelRef.current.contains(target);
      const insideBell = !!notificationsBellRef.current && !!target && notificationsBellRef.current.contains(target);
      if (!insidePanel && !insideBell) {
        setNotificationsOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    window.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    return () => {
      if (incomingToastTimerRef.current) {
        clearTimeout(incomingToastTimerRef.current);
      }
    };
  }, []);

  const goToQuickAction = (href: string) => {
    setNotificationsOpen(false);
    router.push(href);
  };

  const toggleNotifications = () => {
    setNotificationsOpen((prev) => {
      const next = !prev;
      if (next) void loadNotificationItems();
      return next;
    });
  };

  const primaryNavItems: {
    key: string;
    href: string;
    icon: React.ReactNode;
    label: string;
    isActive: (path: string) => boolean;
  }[] = [
    {
      key: 'home',
      href: '/',
      icon: <span className="text-[1.08rem] font-serif font-bold lowercase tracking-[0.015em] text-blue-600">hanar</span>,
      label: t(effectiveLang, 'Feed'),
      isActive: (path) => path === '/',
    },
    {
      key: 'marketplace',
      href: '/marketplace',
      icon: (
        <ShoppingCart className={navLineIconClass} strokeWidth={1.9} stroke="url(#nav-grad-marketplace)">
          <defs>
            <linearGradient id="nav-grad-marketplace" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
          </defs>
        </ShoppingCart>
      ),
      label: t(effectiveLang, 'Marketplace'),
      isActive: (path) => path.startsWith('/marketplace'),
    },
    {
      key: 'businesses',
      href: '/businesses',
      icon: (
        <Store className={navLineIconClass} strokeWidth={1.9} stroke="url(#nav-grad-businesses)">
          <defs>
            <linearGradient id="nav-grad-businesses" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
          </defs>
        </Store>
      ),
      label: t(effectiveLang, 'Businesses'),
      isActive: (path) => path.startsWith('/businesses') || path.startsWith('/business/'),
    },
    {
      key: 'profile',
      href: dashboardIdentity.loggedIn ? '/dashboard' : '/login?redirect=/dashboard',
      icon: dashboardIdentity.loggedIn ? (
        <span className="inline-flex h-[2.1rem] w-[2.1rem] items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-red-600 p-[1.5px]">
          <Avatar
            src={dashboardIdentity.avatarUrl}
            alt="Dashboard profile"
            className="h-full w-full rounded-full"
            unframed
          />
        </span>
      ) : (
        <CircleUserRound className={navLineIconClass} strokeWidth={1.9} stroke="url(#nav-grad-profile)">
          <defs>
            <linearGradient id="nav-grad-profile" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
          </defs>
        </CircleUserRound>
      ),
      label: t(effectiveLang, 'Profile'),
      isActive: (path) => path.startsWith('/dashboard') || (!dashboardIdentity.loggedIn && path.startsWith('/login')),
    },
  ];

  return (
    <>
      <nav className={`fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center border-t border-black bg-slate-100/80 px-1.5 pb-[max(0px,env(safe-area-inset-bottom))] backdrop-blur-sm transition-all duration-200 dark:border-black dark:bg-slate-700/80 sm:hidden ${hidden ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
        <div className="flex w-full items-center gap-0.5">
          {primaryNavItems.map((item) => {
            const isActive = item.isActive(pathname);
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-label={item.label}
                className={`relative inline-flex h-10 min-w-0 flex-1 items-center justify-center rounded-lg transition-colors ${
                  isActive ? 'text-black' : 'text-black/70 hover:bg-black/10 hover:text-black'
                }`}
              >
                {item.icon}
                <span
                  className={`absolute bottom-0 left-2 right-2 h-[3px] rounded-full transition-opacity ${
                    isActive ? 'bg-black opacity-100' : 'opacity-0'
                  }`}
                  aria-hidden
                />
              </Link>
            );
          })}
        </div>
      </nav>

      <nav className={`fixed bottom-0 left-0 right-0 z-50 hidden h-[3.75rem] items-center border-t border-black bg-slate-100/80 px-3 pb-[max(0px,env(safe-area-inset-bottom))] backdrop-blur-sm transition-all duration-200 isolate dark:border-black dark:bg-slate-700/80 sm:flex sm:h-16 ${hidden ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
        <div className="flex w-full items-center gap-1.5">
          {primaryNavItems.map((item) => {
            const isActive = item.isActive(pathname);
            return (
              <Link
                key={`desktop-${item.key}`}
                href={item.href}
                aria-label={item.label}
                className={`relative inline-flex h-10 min-w-0 flex-1 items-center justify-center rounded-lg transition-colors ${
                  isActive ? 'text-black' : 'text-black/70 hover:bg-black/10 hover:text-black'
                }`}
              >
                {item.icon}
                <span
                  className={`absolute bottom-0 left-2 right-2 h-[3px] rounded-full transition-opacity ${
                    isActive ? 'bg-black opacity-100' : 'opacity-0'
                  }`}
                  aria-hidden
                />
              </Link>
            );
          })}
        </div>
      </nav>

      {!isMarketplaceItemDetailPage && (
        <div className={`fixed right-3 top-1 z-[70] flex items-center gap-2 transition-all duration-200 sm:right-4 sm:top-1 ${hidden ? 'translate-y-[-10px] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
          <button
            ref={notificationsBellRef}
            type="button"
            onClick={toggleNotifications}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/45 bg-white/20 text-black shadow-sm backdrop-blur-sm transition hover:bg-white/30"
            aria-label="Open notifications"
            title="Notifications"
            aria-expanded={notificationsOpen}
            aria-haspopup="dialog"
          >
            <Bell className="h-[1.58rem] w-[1.58rem]" strokeWidth={2} stroke="url(#nav-grad-bell)" aria-hidden>
              <defs>
                <linearGradient id="nav-grad-bell" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
              </defs>
            </Bell>
            {unreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-semibold leading-none text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => goToQuickAction('/messages?view=inbox')}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/45 bg-white/20 text-black shadow-sm backdrop-blur-sm transition hover:bg-white/30"
            aria-label="Go to messages"
            title="Messages"
          >
            <MessageCircle className="h-[1.58rem] w-[1.58rem]" strokeWidth={2} stroke="url(#nav-grad-message)" aria-hidden>
              <defs>
                <linearGradient id="nav-grad-message" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
              </defs>
            </MessageCircle>
            {unreadMessageCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-semibold leading-none text-white">
                {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
              </span>
            ) : null}
          </button>
        </div>
      )}

      <div
        ref={notificationsPanelRef}
        role="dialog"
        aria-label="Notifications"
        aria-hidden={!notificationsOpen || isMarketplaceItemDetailPage}
        className={`fixed right-3 top-12 z-[75] w-[min(19rem,calc(100vw-1.5rem))] origin-top-right rounded-xl border border-blue-200 bg-blue-50/95 shadow-2xl transition-all duration-200 sm:right-4 sm:top-12 ${
          notificationsOpen && !isMarketplaceItemDetailPage
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none -translate-y-2 scale-95 opacity-0'
        }`}
      >
        <div className="flex items-center justify-between border-b border-blue-200 px-2.5 py-2">
          <p className="text-sm font-semibold text-slate-900">Notifications</p>
          <button
            type="button"
            onClick={() => goToQuickAction('/notifications')}
            className="rounded-md px-2 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
          >
            View all
          </button>
        </div>
        <div className="max-h-[18rem] overflow-y-auto p-1.5">
          {notificationsLoading ? (
            <p className="px-2 py-4 text-center text-sm text-slate-500">Loading...</p>
          ) : notifications.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-slate-500">No notifications yet.</p>
          ) : (
            <ul className="space-y-1">
              {notifications.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => goToQuickAction(item.url || '/notifications')}
                    className={`w-full rounded-lg border px-2.5 py-1.5 text-left transition hover:bg-slate-50 ${
                      item.read_at ? 'border-slate-200 bg-white' : 'border-blue-300 bg-white'
                    }`}
                  >
                    <p className="line-clamp-1 text-sm font-semibold text-slate-900">{item.title || 'Notification'}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{item.body || 'Open to view details.'}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {incomingMessageToast && (
        <button
          type="button"
          onClick={() => {
            setIncomingToastVisible(false);
            router.push(`/messages?targetType=user&targetId=${encodeURIComponent(incomingMessageToast.senderId)}`);
          }}
          className={`fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+3.5rem)] z-[80] w-auto rounded-2xl border border-indigo-200 bg-white/95 px-4 py-3 text-left shadow-2xl backdrop-blur transition-all duration-300 sm:left-auto sm:right-4 sm:top-20 sm:w-[min(21rem,calc(100vw-1.25rem))] ${
            incomingToastVisible
              ? 'translate-y-0 opacity-100 scale-100'
              : 'pointer-events-none -translate-y-3 opacity-0 scale-95'
          }`}
          aria-label="Open new message"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">New message</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{incomingMessageToast.label} sent you a message</p>
          <p className="mt-1 text-xs text-slate-500">Tap to open conversation</p>
        </button>
      )}
    </>
  );
}
