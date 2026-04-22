'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Menu, MessageCircle } from 'lucide-react';
import MobileMenu from './MobileMenu';
import { supabase } from '@/lib/supabaseClient';
import { writeSavedSearchRadiusMiles } from '@/lib/geoDistance';

type NavbarNotificationRow = {
  id: string;
  type: string;
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [incomingMessageToast, setIncomingMessageToast] = useState<{ messageId: string; senderId: string; label: string } | null>(null);
  const [incomingToastVisible, setIncomingToastVisible] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<NavbarNotificationRow[]>([]);
  const mobileNotificationsWrapRef = useRef<HTMLDivElement | null>(null);
  const desktopNotificationsWrapRef = useRef<HTMLDivElement | null>(null);
  const incomingToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitializedIncomingRef = useRef(false);
  const lastIncomingMessageIdRef = useRef<string | null>(null);
  const shownIncomingToastIdsRef = useRef<Set<string>>(new Set());

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
        .limit(8);
      if (error) {
        setNotifications([]);
        return;
      }
      const rows = (data || []) as NavbarNotificationRow[];
      const visible = rows.filter((row) => {
        const businessId = row.data?.business_id;
        if (businessId && ownedIds.has(String(businessId))) return false;
        return true;
      });
      setNotifications(visible);
    } finally {
      setNotificationsLoading(false);
    }
  }, [fetchOwnedBusinessIds]);

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
            if (notificationsOpen) loadNotificationItems();
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
  }, [fetchOwnedBusinessIds, loadNotificationItems, notificationsOpen]);

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
    return () => {
      if (incomingToastTimerRef.current) {
        clearTimeout(incomingToastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!notificationsOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      const insideMobile =
        !!mobileNotificationsWrapRef.current && !!target && mobileNotificationsWrapRef.current.contains(target);
      const insideDesktop =
        !!desktopNotificationsWrapRef.current && !!target && desktopNotificationsWrapRef.current.contains(target);
      if (!insideMobile && !insideDesktop) {
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

  const handleBellClick = async () => {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);
    if (nextOpen) await loadNotificationItems();
  };

  const handleNotificationClick = async (notification: NavbarNotificationRow) => {
    if (!notification.read_at) {
      const nowIso = new Date().toISOString();
      await supabase
        .from('notifications')
        .update({ read_at: nowIso })
        .eq('id', notification.id)
        .is('read_at', null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notifications:updated'));
      }
    }
    setNotificationsOpen(false);
    router.push(notification.url || '/notifications');
  };

  const handleSeeAllNotifications = () => {
    setNotificationsOpen(false);
    router.push('/notifications');
  };

  const isBusinessSentNotification = (notification: NavbarNotificationRow) => {
    if (notification.type === 'business_update' || notification.type === 'area_blast') return true;
    return Boolean(notification.data?.business_id);
  };

  const isLikeOrCommentNotification = (notification: NavbarNotificationRow) =>
    notification.type === 'post_liked' ||
    notification.type === 'comment_liked' ||
    notification.type === 'comment_on_post';

  const notificationDropdown = (
    <div
      className={`absolute -right-1 top-[calc(100%+0.45rem)] w-[min(18.5rem,calc(100vw-0.75rem))] origin-top-right rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 transition-all duration-200 ${
        notificationsOpen
          ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
          : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
      }`}
      role="menu"
      aria-label="Notifications"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
        <p className="text-sm font-semibold text-slate-900">Notifications</p>
        <button
          type="button"
          onClick={handleSeeAllNotifications}
          className="text-xs font-semibold text-blue-700 transition hover:text-blue-800"
        >
          See all
        </button>
      </div>
      <div className="max-h-[19rem] overflow-y-auto">
        {notificationsLoading ? (
          <div className="px-3 py-4 text-sm text-slate-500">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="px-3 py-4 text-sm text-slate-500">No notifications yet.</div>
        ) : (
          notifications.map((notification) => {
            const isUnread = !notification.read_at;
            const isBusiness = isBusinessSentNotification(notification);
            const isSocial = isLikeOrCommentNotification(notification);
            const unreadRowTone = isBusiness
              ? 'bg-red-100/80 hover:bg-red-100'
              : isSocial
                ? 'bg-blue-100/80 hover:bg-blue-100'
                : 'bg-slate-100/80 hover:bg-slate-100';
            const unreadDotTone = isBusiness
              ? 'bg-red-500'
              : isSocial
                ? 'bg-blue-500'
                : 'bg-rose-500';
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleNotificationClick(notification)}
                className={`flex w-full items-start gap-2.5 border-b border-slate-100 px-3 py-2.5 text-left transition ${
                  isUnread ? unreadRowTone : 'bg-white hover:bg-slate-50'
                }`}
              >
                {isUnread && (
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unreadDotTone}`} aria-hidden />
                )}
                {!isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-transparent" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{notification.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{notification.body}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {new Date(notification.created_at).toLocaleString()}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      <nav className={`sticky top-0 z-50 flex h-14 items-center justify-between bg-gradient-to-r from-blue-700 via-blue-800 to-emerald-600 px-3 transition-all duration-200 dark:from-blue-950 dark:via-blue-900 dark:to-emerald-700 sm:hidden ${hidden ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15 active:scale-[0.97]"
            aria-label="Toggle Menu"
          >
            <Menu className="h-6 w-6 text-white/90" strokeWidth={2} aria-hidden />
          </button>
          <Link href="/" className="text-xl font-serif font-bold lowercase leading-none tracking-[0.015em] sm:text-2xl">
            <span className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">hanar</span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative" ref={mobileNotificationsWrapRef}>
            <button
              type="button"
              onClick={handleBellClick}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              aria-haspopup="menu"
            >
              <Bell className="h-[1.2rem] w-[1.2rem] text-white/90" strokeWidth={2} aria-hidden />
              {unreadCount > 0 && (
                <span className="absolute right-0 top-0 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-semibold leading-none text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            {notificationDropdown}
          </div>
          <Link
            href="/messages?view=inbox"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15"
            aria-label="Messages"
          >
            <MessageCircle className="h-[1.22rem] w-[1.22rem] text-white/90" strokeWidth={2} aria-hidden />
            {unreadMessageCount > 0 && (
              <span className="absolute right-0 top-0 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-semibold leading-none text-white">
                {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
              </span>
            )}
          </Link>
        </div>
      </nav>

      <nav className={`sticky top-0 z-50 hidden h-[3.75rem] items-center justify-between gap-2 bg-gradient-to-r from-blue-700 via-blue-800 to-emerald-600 px-3 transition-all duration-200 isolate dark:from-blue-950 dark:via-blue-900 dark:to-emerald-700 sm:flex sm:h-16 ${hidden ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15 active:scale-[0.97]"
            aria-label="Toggle Menu"
          >
            <Menu className="h-6 w-6 text-white/90" strokeWidth={2} aria-hidden />
          </button>
          <Link
            href="/"
            className="text-xl font-serif font-bold lowercase leading-none tracking-[0.015em] sm:text-2xl"
            aria-label="Home"
          >
            <span className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">hanar</span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative" ref={desktopNotificationsWrapRef}>
            <button
              type="button"
              onClick={handleBellClick}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15 active:scale-[0.97]"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              aria-haspopup="menu"
            >
              <Bell className="h-[1.2rem] w-[1.2rem] text-white/90" strokeWidth={2} aria-hidden />
              {unreadCount > 0 && (
                <span className="absolute right-0 top-0 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-semibold leading-none text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            {notificationDropdown}
          </div>
          <Link
            href="/messages?view=inbox"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15 active:scale-[0.97]"
            aria-label="Messages"
          >
            <MessageCircle className="h-[1.22rem] w-[1.22rem] text-white/90" strokeWidth={2} aria-hidden />
            {unreadMessageCount > 0 && (
              <span className="absolute right-0 top-0 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-semibold leading-none text-white">
                {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
              </span>
            )}
          </Link>
        </div>
      </nav>

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

      {/* Mobile Menu Drawer */}
      <MobileMenu isOpen={menuOpen} setIsOpen={setMenuOpen} />
    </>
  );
}
