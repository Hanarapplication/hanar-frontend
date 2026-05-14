'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, MessageCircle, CircleUserRound, ShoppingCart, Store, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Avatar } from '@/components/Avatar';
import { writeSavedSearchRadiusMiles } from '@/lib/geoDistance';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

/** SVGs: explicit box, no flex shrink, `block` avoids sub-pixel baseline gaps in WebKit/Chrome. */
const navLineIconClass = 'h-[1.7rem] w-[1.7rem] max-h-[1.7rem] max-w-[1.7rem] shrink-0 block';
/** Facebook-style top bar icon hit target */
const topNavIconBtn =
  'relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[#65676B] transition-colors hover:bg-[#f2f2f2] active:scale-[0.97] dark:text-[#e4e6eb] dark:hover:bg-white/10 [-webkit-tap-highlight-color:transparent]';

type NavbarNotificationRow = {
  id: string;
  type?: string | null;
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
  const [dashboardIdentity, setDashboardIdentity] = useState<{
    loggedIn: boolean;
    avatarUrl: string | null;
    /** Public business /profile /organization URL only; null when logged out or not yet available */
    publicProfileHref: string | null;
    accountKind: 'business' | 'organization' | 'individual' | null;
  }>({
    loggedIn: false,
    avatarUrl: null,
    publicProfileHref: null,
    accountKind: null,
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
        if (!cancelled)
          setDashboardIdentity({
            loggedIn: false,
            avatarUrl: null,
            publicProfileHref: null,
            accountKind: null,
          });
        return;
      }
      const [regRes, profileRes, orgRes, businessRes] = await Promise.all([
        supabase.from('registeredaccounts').select('business, organization, username').eq('user_id', user.id).maybeSingle(),
        supabase.from('profiles').select('profile_pic_url, username').eq('id', user.id).maybeSingle(),
        supabase.from('organizations').select('logo_url, username').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('businesses')
          .select('logo_url, slug, created_at')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const reg = regRes.data;
      let publicProfileHref: string | null = null;
      let accountKind: 'business' | 'organization' | 'individual';

      if (reg?.business === true) {
        accountKind = 'business';
        const slug = (businessRes.data?.slug && String(businessRes.data.slug).trim()) || '';
        publicProfileHref = slug ? `/business/${encodeURIComponent(slug)}` : '/business-dashboard';
      } else if (reg?.organization === true) {
        accountKind = 'organization';
        const orgUsername = (orgRes.data?.username && String(orgRes.data.username).trim()) || '';
        publicProfileHref = orgUsername ? `/organization/${encodeURIComponent(orgUsername)}` : null;
      } else {
        accountKind = 'individual';
        const username =
          (profileRes.data?.username && String(profileRes.data.username).trim()) ||
          (reg?.username && String(reg.username).trim()) ||
          '';
        publicProfileHref = username ? `/profile/${encodeURIComponent(username)}` : null;
      }

      const avatarUrl =
        normalizeAvatarUrl(profileRes.data?.profile_pic_url, ['avatars']) ||
        normalizeAvatarUrl(orgRes.data?.logo_url, ['organizations', 'organization-uploads']) ||
        normalizeAvatarUrl(businessRes.data?.logo_url, ['business-uploads']) ||
        null;
      setDashboardIdentity({ loggedIn: true, avatarUrl, publicProfileHref, accountKind });
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

  const fetchOwnedBusinessIds = useCallback(async (userId: string) => {
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', userId);
    if (error) return new Set<string>();
    return new Set((businesses || []).map((row) => String((row as any).id)));
  }, []);

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
        .select('id, type, title, body, url, created_at, read_at, data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) {
        setNotifications([]);
        return;
      }
      const rows = (data || []) as NavbarNotificationRow[];
      setNotifications(
        rows
          .filter((row) => row.type !== 'direct_message')
          .filter((row) => {
            const businessId = row.data?.business_id;
            if (businessId && ownedIds.has(String(businessId))) return false;
            return true;
          })
          .slice(0, 8)
      );
    } finally {
      setNotificationsLoading(false);
    }
  }, [fetchOwnedBusinessIds]);

  /** Flutter WebView: native code runs fetch + dispatches this so badges stay correct without relying on Realtime alone. */
  useEffect(() => {
    const onHanarUnreadFromApp = (e: Event) => {
      const d = (e as CustomEvent<{ directMessagesUnread?: number; bellNotificationsUnread?: number }>).detail;
      if (!d) return;
      if (typeof d.directMessagesUnread === 'number') setUnreadMessageCount(d.directMessagesUnread);
      if (typeof d.bellNotificationsUnread === 'number') setUnreadCount(d.bellNotificationsUnread);
    };
    window.addEventListener('hanar:unread-counts', onHanarUnreadFromApp as EventListener);
    return () => window.removeEventListener('hanar:unread-counts', onHanarUnreadFromApp as EventListener);
  }, []);

  useEffect(() => {
    const loadUnreadCount = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setUnreadCount(0);
        return;
      }

      const ownedIds = await fetchOwnedBusinessIds(user.id);

      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, data')
        .eq('user_id', user.id)
        .is('read_at', null);

      if (error) {
        setUnreadCount(0);
        return;
      }

      const rows = (data || []) as Array<{ id: string; type?: string | null; data?: { business_id?: string } }>;
      const visible = rows.filter((row) => {
        if (row.type === 'direct_message') return false;
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
          (payload) => {
            const eventType = (payload as { eventType?: string }).eventType;
            const row = (payload as { new?: { type?: string | null } }).new;
            const isDirectMessageNotif = row?.type === 'direct_message';
            loadUnreadCount();
            if (isDirectMessageNotif) return;
            if (eventType === 'INSERT') {
              setNotificationsOpen(true);
              void loadNotificationItems();
            }
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
  }, [fetchOwnedBusinessIds, loadNotificationItems]);

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

  // Dashboard is one of the heaviest pages; prefetch it so profile tap feels immediate.
  useEffect(() => {
    const target = dashboardIdentity.loggedIn ? '/dashboard' : '/login?redirect=/dashboard';
    try {
      router.prefetch(target);
      const pub = dashboardIdentity.publicProfileHref;
      if (dashboardIdentity.loggedIn && pub && !pub.includes('login')) {
        router.prefetch(pub);
      }
    } catch {
      // ignore prefetch errors
    }
  }, [dashboardIdentity.loggedIn, dashboardIdentity.publicProfileHref, router]);

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
    icon: (isActive: boolean) => React.ReactNode;
    label: string;
    isActive: (path: string) => boolean;
  }[] = [
    {
      key: 'home',
      href: '/',
      icon: (isActive) => (
        <span
          className={`shrink-0 text-[1.25rem] font-semibold leading-none tracking-normal lowercase text-[#1877F2] ${
            isActive ? 'opacity-100' : 'opacity-80 hover:opacity-100'
          }`}
        >
          hanar
        </span>
      ),
      label: t(effectiveLang, 'Feed'),
      isActive: (path) => path === '/' || path === '/home-feed',
    },
    {
      key: 'marketplace',
      href: '/marketplace',
      icon: (isActive) => (
        <ShoppingCart
          className={`${navLineIconClass} ${isActive ? 'text-[#1877F2]' : ''}`}
          strokeWidth={2}
          aria-hidden
        />
      ),
      label: t(effectiveLang, 'Marketplace'),
      isActive: (path) => path.startsWith('/marketplace'),
    },
    {
      key: 'businesses',
      href: '/businesses',
      icon: (isActive) => (
        <Store
          className={`${navLineIconClass} ${isActive ? 'text-[#1877F2]' : ''}`}
          strokeWidth={2}
          aria-hidden
        />
      ),
      label: t(effectiveLang, 'Businesses'),
      isActive: (path) => path.startsWith('/businesses') || path.startsWith('/business/'),
    },
    {
      key: 'profile',
      href: dashboardIdentity.loggedIn ? '/dashboard' : '/login?redirect=/dashboard',
      icon: (isActive) =>
        dashboardIdentity.loggedIn ? (
          <span
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-white p-px ${
              isActive ? 'border-[#1877F2] ring-2 ring-[#1877F2] ring-offset-1 ring-offset-white dark:bg-[#3a3b3c] dark:ring-offset-[#242526]' : 'border-[#e4e6eb] dark:border-[#3e4042]'
            }`}
          >
            <Avatar
              src={dashboardIdentity.avatarUrl}
              alt="Dashboard profile"
              className="m-0 block h-full w-full rounded-full"
              unframed
            />
          </span>
        ) : (
          <CircleUserRound
            className={`${navLineIconClass} ${isActive ? 'text-[#1877F2]' : ''}`}
            strokeWidth={1.9}
            aria-hidden
          />
        ),
      label: t(effectiveLang, 'Dashboard'),
      isActive: (path) => path.startsWith('/dashboard') || (!dashboardIdentity.loggedIn && path.startsWith('/login')),
    },
  ];

  const homeNav = primaryNavItems[0]!;
  const midNavItems = primaryNavItems.slice(1, 3);
  const profileNav = primaryNavItems[3]!;

  const profileIconHref = useMemo(() => {
    const d = dashboardIdentity;
    if (!d.loggedIn) return '/login?redirect=/dashboard';
    if (d.publicProfileHref) return d.publicProfileHref;
    if (d.accountKind === 'organization') return '/organization/dashboard';
    if (d.accountKind === 'individual') return '/dashboard/account';
    if (d.accountKind === 'business') return '/business-dashboard';
    return '/login?redirect=/dashboard';
  }, [dashboardIdentity]);

  const myPublicPageActive = useMemo(() => {
    const href = dashboardIdentity.publicProfileHref;
    if (!href || !dashboardIdentity.loggedIn) return false;
    const path = (pathname || '').split('?')[0];
    if (path === href) return true;
    return path.startsWith(`${href}/`);
  }, [dashboardIdentity.loggedIn, dashboardIdentity.publicProfileHref, pathname]);

  return (
    <>
      <nav
        data-top-nav="true"
        className={`fixed top-0 left-0 right-0 z-[120] border-b border-[#e4e6eb] bg-white pt-[env(safe-area-inset-top,0px)] shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-200 dark:border-[#3e4042] dark:bg-[#242526] dark:shadow-[0_1px_0_rgba(0,0,0,0.35)] ${
          hidden ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}
      >
        <div className="mx-auto flex h-14 min-h-14 max-w-[1920px] items-center gap-1 px-2 sm:gap-2 sm:px-3">
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <Link
              href={homeNav.href}
              aria-label={homeNav.label}
              onClick={() => setNotificationsOpen(false)}
              className="flex shrink-0 items-center rounded-md px-1.5 py-2 transition hover:bg-[#f2f2f2] dark:hover:bg-white/10"
            >
              {homeNav.icon(homeNav.isActive(pathname))}
            </Link>
            {midNavItems.map((item) => {
              const isActive = item.isActive(pathname);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-label={item.label}
                  onClick={() => setNotificationsOpen(false)}
                  className={`${topNavIconBtn} ${isActive ? 'text-[#1877F2] dark:text-[#4599ff]' : ''}`}
                >
                  {item.icon(isActive)}
                </Link>
              );
            })}
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-1 px-1 sm:gap-2 sm:px-2">
            <Link
              href={profileNav.href}
              aria-label={t(effectiveLang, 'Dashboard')}
              title={t(effectiveLang, 'Dashboard')}
              onClick={() => setNotificationsOpen(false)}
              className={`${topNavIconBtn} p-0.5 ${profileNav.isActive(pathname) ? 'ring-2 ring-[#1877F2] ring-offset-1 ring-offset-white dark:ring-offset-[#242526]' : ''}`}
            >
              {profileNav.icon(profileNav.isActive(pathname))}
            </Link>
            <Link
              href={profileIconHref}
              onClick={() => setNotificationsOpen(false)}
              className={`${topNavIconBtn} ${myPublicPageActive ? 'text-[#1877F2] dark:text-[#4599ff]' : ''}`}
              aria-label={t(effectiveLang, 'Profile')}
              title={t(effectiveLang, 'Profile')}
            >
              <UserRound className="h-7 w-7" strokeWidth={2} aria-hidden />
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => goToQuickAction('/messages?view=inbox')}
              className={topNavIconBtn}
              aria-label="Go to messages"
              title="Messages"
            >
              <MessageCircle className="h-6 w-6" strokeWidth={2} aria-hidden />
              {unreadMessageCount > 0 ? (
                <span className="absolute right-1 top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#e41e3f] px-0.5 text-[10px] font-semibold leading-none text-white">
                  {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                </span>
              ) : null}
            </button>

            <button
              ref={notificationsBellRef}
              type="button"
              onClick={toggleNotifications}
              className={topNavIconBtn}
              aria-label="Open notifications"
              title="Notifications"
              aria-expanded={notificationsOpen}
              aria-haspopup="dialog"
            >
              <Bell className="h-6 w-6" strokeWidth={2} aria-hidden />
              {unreadCount > 0 ? (
                <span className="absolute right-1 top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#e41e3f] px-0.5 text-[10px] font-semibold leading-none text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </nav>

      <div
        ref={notificationsPanelRef}
        role="dialog"
        aria-label="Notifications"
        aria-hidden={!notificationsOpen}
        className={`fixed right-2 z-[125] w-[min(19rem,calc(100vw-1rem))] origin-top-right rounded-xl border border-[#e4e6eb] bg-white shadow-2xl transition-all duration-200 dark:border-[#3e4042] dark:bg-[#242526] sm:right-3 ${
          notificationsOpen
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none -translate-y-2 scale-95 opacity-0'
        } top-[calc(env(safe-area-inset-top,0px)+3.5rem+2px)]`}
      >
        <div className="flex items-center justify-between border-b border-[#e4e6eb] px-2.5 py-2 dark:border-[#3e4042]">
          <p className="text-sm font-semibold text-[#050505] dark:text-[#e4e6eb]">Notifications</p>
          <button
            type="button"
            onClick={() => goToQuickAction('/notifications')}
            className="rounded-md px-2 py-1 text-xs font-medium text-[#1877F2] transition hover:bg-[#f0f2f5] dark:hover:bg-white/10"
          >
            View all
          </button>
        </div>
        <div className="max-h-[18rem] overflow-y-auto p-1.5">
          {notificationsLoading ? (
            <p className="px-2 py-4 text-center text-sm text-[#65676B] dark:text-[#b0b3b8]">Loading...</p>
          ) : notifications.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-[#65676B] dark:text-[#b0b3b8]">No notifications yet.</p>
          ) : (
            <ul className="space-y-1">
              {notifications.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => goToQuickAction(item.url || '/notifications')}
                    className={`w-full rounded-lg border px-2.5 py-1.5 text-left transition hover:bg-[#f2f2f2] dark:hover:bg-white/5 ${
                      item.read_at ? 'border-[#e4e6eb] bg-white dark:border-[#3e4042] dark:bg-[#242526]' : 'border-[#1877F2]/40 bg-[#f0f7ff] dark:border-[#4599ff]/35 dark:bg-[#2d3748]'
                    }`}
                  >
                    <p className="line-clamp-1 text-sm font-semibold text-[#050505] dark:text-[#e4e6eb]">
                      {item.title || 'Notification'}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[#65676B] dark:text-[#b0b3b8]">
                      {item.body || 'Open to view details.'}
                    </p>
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
            router.push(
              `/messages?targetType=user&targetId=${encodeURIComponent(incomingMessageToast.senderId)}&conversation_id=${encodeURIComponent(incomingMessageToast.senderId)}`,
            );
          }}
          className={`fixed left-3 right-3 z-[80] w-auto rounded-2xl border border-[#e4e6eb] bg-white px-4 py-3 text-left shadow-2xl transition-all duration-300 dark:border-[#3e4042] dark:bg-[#242526] sm:left-auto sm:right-4 sm:w-[min(21rem,calc(100vw-1.25rem))] ${
            incomingToastVisible
              ? 'translate-y-0 opacity-100 scale-100'
              : 'pointer-events-none -translate-y-3 opacity-0 scale-95'
          } top-[calc(env(safe-area-inset-top,0px)+3.5rem+0.75rem)]`}
          aria-label="Open new message"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1877F2]">New message</p>
          <p className="mt-1 text-sm font-semibold text-[#050505] dark:text-[#e4e6eb]">
            {incomingMessageToast.label} sent you a message
          </p>
          <p className="mt-1 text-xs text-[#65676B] dark:text-[#b0b3b8]">Tap to open conversation</p>
        </button>
      )}
    </>
  );
}
