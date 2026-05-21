'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Bell, CircleUserRound, MessageCircle, ShoppingCart, Store } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Avatar } from '@/components/Avatar';
import { writeSavedSearchRadiusMiles } from '@/lib/geoDistance';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';
import NavbarEntitySearch from '@/components/NavbarEntitySearch';
import { cn } from '@/lib/utils';
import {
  clearBusinessesBackToHomeFeedIfLeftDirectory,
  clearBusinessesBackToHomeFeedIntent,
  peekBusinessesEnteredFromBusinessSlug,
} from '@/lib/businessesDirectoryNav';
import { removeNotificationsForInactivePosts } from '@/lib/postNotificationCleanup';

/** Facebook-style top bar icon hit target */
const topNavIconBtn =
  'relative inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-black transition-colors hover:bg-[#f2f2f2] active:scale-[0.97] dark:text-[#e4e6eb] dark:hover:bg-white/10 [-webkit-tap-highlight-color:transparent]';
const topNavProfileIconClass = 'h-9 w-9 max-h-9 max-w-9 shrink-0 block sm:h-10 sm:w-10 sm:max-h-10 sm:max-w-10';

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

export default function Navbar({
  hidden = false,
  onHomeBottomBarDocked,
}: {
  hidden?: boolean;
  /** When false, home feed main content can reduce bottom padding (tab bar scrolled off-screen). */
  onHomeBottomBarDocked?: (docked: boolean) => void;
}) {
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

  useEffect(() => {
    if (pathname !== '/') setNotificationsOpen(false);
  }, [pathname]);
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

  /** When the app updates `userCoords` (businesses/marketplace/etc.), mirror to server if signed in — not on bare page refresh. */
  useEffect(() => {
    const handleLocationUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | {
            lat?: number;
            lon?: number;
            label?: string;
            radiusMiles?: number;
            city?: string | null;
            state?: string | null;
            zip?: string | null;
            source?: string;
          }
        | undefined;
      if (detail?.lat != null && detail?.lon != null) {
        void (async () => {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user) {
            await persistLocation(detail.lat!, detail.lon!, {
              city: detail.city ?? null,
              state: detail.state ?? null,
              zip: detail.zip ?? null,
              source: detail.source,
            });
          }
        })();
      }
      if (detail?.label) localStorage.setItem('userLocationLabel', detail.label);
      if (detail?.radiusMiles != null) writeSavedSearchRadiusMiles(detail.radiusMiles);
    };
    window.addEventListener('location:updated', handleLocationUpdated as EventListener);
    return () => window.removeEventListener('location:updated', handleLocationUpdated as EventListener);
  }, [persistLocation]);

  /** Push stored coords to the server once after login — not on every page refresh. */
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
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') void syncStoredLocationIfLoggedIn();
    });
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
      const businessFiltered = rows
        .filter((row) => row.type !== 'direct_message')
        .filter((row) => {
          const businessId = row.data?.business_id;
          if (businessId && ownedIds.has(String(businessId))) return false;
          return true;
        });
      const { visible, removedIds } = await removeNotificationsForInactivePosts(supabase, businessFiltered);
      if (removedIds.length > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notifications:updated'));
      }
      setNotifications(visible.slice(0, 8));
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
      const businessFiltered = rows.filter((row) => {
        if (row.type === 'direct_message') return false;
        const businessId = row.data?.business_id;
        if (businessId && ownedIds.has(String(businessId))) return false;
        return true;
      });
      const { visible, removedIds } = await removeNotificationsForInactivePosts(supabase, businessFiltered);
      if (removedIds.length > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notifications:updated'));
      }
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
    const target = dashboardIdentity.loggedIn ? '/dashboard' : '/login?redirect=/';
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

  /** Home bottom bar — white chips without borders. */
  const homeBottomBarChip =
    'relative flex h-full min-h-[3.25rem] w-full min-w-0 flex-col items-center justify-center gap-0.5 overflow-visible rounded-2xl bg-white px-0.5 py-1 text-slate-800 transition-all duration-200 ease-out hover:bg-slate-50/60 active:scale-[0.97] active:bg-pink-200/55 active:text-pink-700 active:[&_span]:text-pink-700 active:[&_svg]:text-pink-600 [-webkit-tap-highlight-color:transparent]';
  const homeBottomBarChipActive =
    'bg-white text-pink-700 hover:bg-pink-50/40 [&_span]:text-pink-700 [&_svg]:text-pink-600';
  const homeBottomBarChipSplash =
    'bg-pink-100 text-pink-700 [&_span]:text-pink-700 [&_svg]:text-pink-600';
  const homeBottomBarIconClass = 'h-6 w-6 shrink-0 text-slate-700';
  const homeBottomBarIconWrap = 'relative inline-flex shrink-0 items-center justify-center';
  const homeBottomBarIconBadge =
    'pointer-events-none absolute -right-2 -top-1.5 z-10 inline-flex h-[15px] min-w-[15px] max-w-none shrink-0 items-center justify-center rounded-full bg-pink-500 px-0.5 text-[9px] font-bold leading-none text-white ring-2 ring-white shadow-sm whitespace-nowrap';
  const homeBottomBarTabStack = 'flex w-full min-w-0 max-w-full flex-col items-center justify-center gap-0.5';
  const homeBottomBarChipLabel =
    'block w-full min-w-0 max-w-full px-0.5 text-center text-[8px] font-semibold leading-[1.15] tracking-tight text-inherit hyphens-auto whitespace-normal break-words [overflow-wrap:anywhere] sm:text-[9px]';

  const renderHomeBottomBarTab = (
    icon: React.ReactNode,
    label: string,
    badgeCount?: number
  ) => (
    <span className={homeBottomBarTabStack}>
      <span className={homeBottomBarIconWrap}>
        {icon}
        {badgeCount != null && badgeCount > 0 ? (
          <span className={homeBottomBarIconBadge}>{badgeCount > 99 ? '99+' : badgeCount}</span>
        ) : null}
      </span>
      <span className={homeBottomBarChipLabel} title={label}>
        {label}
      </span>
    </span>
  );

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
          className={`shrink-0 text-[1.625rem] font-semibold leading-none tracking-normal lowercase text-pink-600 sm:text-[1.75rem] dark:text-pink-400 ${
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
      icon: () => <ShoppingCart className={homeBottomBarIconClass} strokeWidth={2} aria-hidden />,
      label: t(effectiveLang, 'Marketplace'),
      isActive: (path) => path.startsWith('/marketplace'),
    },
    {
      key: 'businesses',
      href: '/businesses',
      icon: () => <Store className={homeBottomBarIconClass} strokeWidth={2} aria-hidden />,
      label: t(effectiveLang, 'Businesses'),
      isActive: (path) => path.startsWith('/businesses') || path.startsWith('/business/'),
    },
    {
      key: 'profile',
      href: dashboardIdentity.loggedIn ? '/dashboard' : '/login?redirect=/',
      icon: (isActive) =>
        dashboardIdentity.loggedIn ? (
          <span
            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border bg-white p-px sm:h-[3.25rem] sm:w-[3.25rem] ${
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
            className={`${topNavProfileIconClass} text-black dark:text-[#e4e6eb]`}
            strokeWidth={1.9}
            aria-hidden
          />
        ),
      label: t(effectiveLang, 'Dashboard'),
      isActive: (path) => path.startsWith('/dashboard') || (!dashboardIdentity.loggedIn && path.startsWith('/login')),
    },
  ];

  const homeNav = primaryNavItems[0]!;
  const marketplaceItem = primaryNavItems[1]!;
  const businessesItem = primaryNavItems[2]!;
  const profileNav = primaryNavItems[3]!;

  const isHomeFeedRoute = pathname === '/';
  const isBusinessesDirectoryPage = pathname.startsWith('/businesses');
  const isMarketplaceDirectoryPage = pathname === '/marketplace';
  /** Marketplace, businesses, business dashboard: no nav bottom rule — content continues as one white card. */
  const isDirectorySearchChromeRoute =
    pathname.startsWith('/marketplace') ||
    pathname.startsWith('/businesses') ||
    pathname.startsWith('/business-dashboard');
  /** Same left mark as home (hanar) on legacy /home-feed; bottom tab bar still only on `/`. */
  const showHanarHomeMark = pathname === '/' || pathname === '/home-feed';

  useEffect(() => {
    clearBusinessesBackToHomeFeedIfLeftDirectory(pathname);
  }, [pathname]);

  const goBackSmart = useCallback(() => {
    setNotificationsOpen(false);
    if (typeof window === 'undefined') {
      router.push('/');
      return;
    }
    if (pathname.startsWith('/businesses') && peekBusinessesEnteredFromBusinessSlug()) {
      clearBusinessesBackToHomeFeedIntent();
      router.push('/');
      return;
    }
    /** Next.js App Router often tracks stack position on `history.state.idx`. */
    const st = window.history.state as { idx?: number } | null;
    if (typeof st?.idx === 'number' && st.idx > 0) {
      router.back();
      return;
    }
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/');
  }, [router, pathname]);

  /** Twitter-style: hide fixed bottom tab bar while scrolling down; show on scroll up / near top. */
  const [homeBottomBarScrollHidden, setHomeBottomBarScrollHidden] = useState(false);
  const [homeBottomBarSplash, setHomeBottomBarSplash] = useState<string | null>(null);
  const homeBottomBarSplashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollYRef = useRef(0);
  const scrollTickingRef = useRef(false);

  const triggerHomeBottomBarSplash = useCallback((key: string) => {
    if (homeBottomBarSplashTimerRef.current) {
      clearTimeout(homeBottomBarSplashTimerRef.current);
    }
    setHomeBottomBarSplash(key);
    homeBottomBarSplashTimerRef.current = setTimeout(() => {
      setHomeBottomBarSplash(null);
      homeBottomBarSplashTimerRef.current = null;
    }, 420);
  }, []);

  useEffect(() => {
    return () => {
      if (homeBottomBarSplashTimerRef.current) {
        clearTimeout(homeBottomBarSplashTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isHomeFeedRoute || hidden) {
      setHomeBottomBarScrollHidden(false);
      return;
    }
    lastScrollYRef.current = typeof window !== 'undefined' ? window.scrollY : 0;

    const onScrollFrame = () => {
      scrollTickingRef.current = false;
      const y = window.scrollY;
      const last = lastScrollYRef.current;
      const dy = y - last;
      if (y < 72) {
        setHomeBottomBarScrollHidden(false);
      } else if (dy > 8) {
        setHomeBottomBarScrollHidden(true);
      } else if (dy < -8) {
        setHomeBottomBarScrollHidden(false);
      }
      lastScrollYRef.current = y;
    };

    const onScroll = () => {
      if (!scrollTickingRef.current) {
        scrollTickingRef.current = true;
        requestAnimationFrame(onScrollFrame);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHomeFeedRoute, hidden]);

  useEffect(() => {
    if (!isHomeFeedRoute) {
      onHomeBottomBarDocked?.(true);
      return;
    }
    const docked = !hidden && !homeBottomBarScrollHidden;
    onHomeBottomBarDocked?.(docked);
  }, [isHomeFeedRoute, hidden, homeBottomBarScrollHidden, onHomeBottomBarDocked]);

  const homeBottomBarOffScreen = hidden || homeBottomBarScrollHidden;

  return (
    <>
      <nav
        data-top-nav="true"
        className={cn(
          'fixed top-0 left-0 right-0 z-[120] bg-white pt-[env(safe-area-inset-top,0px)] transition-all duration-200',
          isDirectorySearchChromeRoute || isHomeFeedRoute
            ? 'border-b-0 shadow-none dark:border-b-0 dark:bg-white dark:shadow-none'
            : 'border-b border-[#e4e6eb] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:border-[#e4e6eb] dark:bg-white dark:shadow-[0_1px_2px_rgba(0,0,0,0.05)]',
          hidden ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100',
        )}
      >
        <div className="relative mx-auto flex h-16 min-h-16 max-w-[1920px] items-center justify-between gap-2.5 px-3 sm:gap-3 sm:px-4">
          <div className="flex shrink-0 items-center">
            {showHanarHomeMark ? (
              <Link
                href={homeNav.href}
                aria-label={homeNav.label}
                onClick={() => setNotificationsOpen(false)}
                className="flex shrink-0 items-center rounded-md px-2 py-1.5 transition hover:bg-[#f2f2f2] dark:hover:bg-white/10"
              >
                {homeNav.icon(homeNav.isActive(pathname))}
              </Link>
            ) : (
              <button
                type="button"
                aria-label={t(effectiveLang, 'Back')}
                title={t(effectiveLang, 'Back')}
                onClick={goBackSmart}
                className={cn(
                  topNavIconBtn,
                  'text-pink-600 opacity-80 hover:opacity-100 dark:text-pink-400',
                )}
              >
                <ArrowLeft className="h-7 w-7" strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>
          {isBusinessesDirectoryPage || isMarketplaceDirectoryPage ? (
            <h1 className="pointer-events-none absolute inset-x-0 truncate px-16 text-center text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              {isBusinessesDirectoryPage ? t(effectiveLang, 'Businesses') : t(effectiveLang, 'Marketplace')}
            </h1>
          ) : null}
          <div className="relative z-[1] flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-1.5">
            <NavbarEntitySearch effectiveLang={effectiveLang} />
            <Link
              href={profileNav.href}
              aria-label={t(effectiveLang, 'Dashboard')}
              title={t(effectiveLang, 'Dashboard')}
              onClick={() => setNotificationsOpen(false)}
              className={`${topNavIconBtn} shrink-0 p-0.5 ${profileNav.isActive(pathname) ? 'ring-2 ring-[#1877F2] ring-offset-1 ring-offset-white dark:ring-offset-[#242526]' : ''}`}
            >
              {profileNav.icon(profileNav.isActive(pathname))}
            </Link>
          </div>
        </div>
      </nav>

      {isHomeFeedRoute ? (
        <nav
          aria-label="Home feed quick actions"
          className={`fixed bottom-0 left-0 right-0 z-[115] overflow-visible border-t border-slate-200/60 bg-white pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_32px_rgba(15,23,42,0.08)] dark:border-slate-200/60 dark:bg-white ${
            hidden
              ? 'translate-y-full opacity-0 pointer-events-none transition-all duration-200'
              : homeBottomBarScrollHidden
                ? 'translate-y-full pointer-events-none transition-transform duration-300 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]'
                : 'translate-y-0 transition-transform duration-300 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]'
          }`}
        >
          <div className="mx-auto grid min-h-[4.25rem] w-full max-w-[1920px] auto-rows-fr grid-cols-4 items-stretch gap-1 overflow-visible px-1.5 py-1.5 sm:gap-1.5 sm:px-2.5">
            <Link
              href={businessesItem.href}
              aria-label={businessesItem.label}
              onClick={() => {
                triggerHomeBottomBarSplash('businesses');
                setNotificationsOpen(false);
              }}
              className={cn(
                homeBottomBarChip,
                businessesItem.isActive(pathname) && homeBottomBarChipActive,
                homeBottomBarSplash === 'businesses' && homeBottomBarChipSplash,
              )}
            >
              {renderHomeBottomBarTab(
                businessesItem.icon(businessesItem.isActive(pathname)),
                businessesItem.label
              )}
            </Link>
            <Link
              href={marketplaceItem.href}
              aria-label={marketplaceItem.label}
              onClick={() => {
                triggerHomeBottomBarSplash('marketplace');
                setNotificationsOpen(false);
              }}
              className={cn(
                homeBottomBarChip,
                marketplaceItem.isActive(pathname) && homeBottomBarChipActive,
                homeBottomBarSplash === 'marketplace' && homeBottomBarChipSplash,
              )}
            >
              {renderHomeBottomBarTab(
                marketplaceItem.icon(marketplaceItem.isActive(pathname)),
                marketplaceItem.label
              )}
            </Link>
            <button
              type="button"
              onClick={() => {
                triggerHomeBottomBarSplash('messages');
                goToQuickAction('/messages?view=inbox');
              }}
              className={cn(
                homeBottomBarChip,
                pathname.startsWith('/messages') && homeBottomBarChipActive,
                homeBottomBarSplash === 'messages' && homeBottomBarChipSplash,
              )}
              aria-label={t(effectiveLang, 'Messages')}
              title={t(effectiveLang, 'Messages')}
            >
              {renderHomeBottomBarTab(
                <MessageCircle className={homeBottomBarIconClass} strokeWidth={2} aria-hidden />,
                t(effectiveLang, 'Messages'),
                unreadMessageCount
              )}
            </button>
            <button
              ref={notificationsBellRef}
              type="button"
              onClick={() => {
                triggerHomeBottomBarSplash('notifications');
                toggleNotifications();
              }}
              className={cn(
                homeBottomBarChip,
                notificationsOpen && homeBottomBarChipActive,
                homeBottomBarSplash === 'notifications' && homeBottomBarChipSplash,
              )}
              aria-label={t(effectiveLang, 'Notifications')}
              title={t(effectiveLang, 'Notifications')}
              aria-expanded={notificationsOpen}
              aria-haspopup="dialog"
            >
              {renderHomeBottomBarTab(
                <Bell className={homeBottomBarIconClass} strokeWidth={2} aria-hidden />,
                t(effectiveLang, 'Notifications'),
                unreadCount
              )}
            </button>
          </div>
        </nav>
      ) : null}

      <div
        ref={notificationsPanelRef}
        role="dialog"
        aria-label="Notifications"
        aria-hidden={!notificationsOpen}
        className={`fixed right-2 z-[125] w-[min(19rem,calc(100vw-1rem))] rounded-xl border border-[#e4e6eb] bg-white shadow-2xl transition-all duration-200 dark:border-[#3e4042] dark:bg-[#242526] sm:right-3 ${
          isHomeFeedRoute
            ? `origin-bottom-right ${notificationsOpen ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-2 scale-95 opacity-0'} ${
                homeBottomBarOffScreen
                  ? 'bottom-[calc(env(safe-area-inset-bottom,0px)+10px)]'
                  : 'bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px)+6px)]'
              }`
            : `origin-top-right top-[calc(env(safe-area-inset-top,0px)+4rem+2px)] ${
                notificationsOpen
                  ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
                  : 'pointer-events-none -translate-y-2 scale-95 opacity-0'
              }`
        }`}
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
          } top-[calc(env(safe-area-inset-top,0px)+4rem+0.75rem)]`}
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
