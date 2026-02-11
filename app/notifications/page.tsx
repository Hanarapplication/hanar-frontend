'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  url?: string | null;
  created_at: string;
  read_at?: string | null;
  data?: {
    business_name?: string;
  };
};

export default function NotificationsPage() {
  const router = useRouter();
  const { effectiveLang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [ownBusinessIds, setOwnBusinessIds] = useState<string[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const rawOffsetRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreLockRef = useRef(false);
  const PAGE_SIZE = 6;
  const hiddenTypes = useRef(new Set<string>());

  const fetchVisibleBatch = async (
    targetUserId: string,
    ownedBusinessIds: string[],
    startOffset: number,
    targetCount: number
  ) => {
    let offset = startOffset;
    let visible: NotificationRow[] = [];
    let reachedEnd = false;

    while (visible.length < targetCount && !reachedEnd) {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, url, created_at, read_at, data')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;
      const rows = (data as NotificationRow[]) || [];
      const filtered = rows.filter((row) => {
        if (hiddenTypes.current.has(row.type)) return false;
        const businessId = (row as any)?.data?.business_id;
        if (businessId && ownedBusinessIds.includes(String(businessId))) return false;
        return true;
      });
      visible = [...visible, ...filtered];
      offset += rows.length;
      if (rows.length < PAGE_SIZE) {
        reachedEnd = true;
      }
      if (rows.length === 0) {
        reachedEnd = true;
      }
    }

    return { visible, nextOffset: offset, hasMore: !reachedEnd };
  };

  const markAsRead = async (id: string) => {
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: nowIso })
      .eq('id', id)
      .is('read_at', null);
    if (error) throw error;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: nowIso } : n))
    );
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications:updated'));
    }
  };

  const handleNotificationClick = async (notification: NotificationRow) => {
    try {
      if (!notification.read_at) {
        await markAsRead(notification.id);
      }
    } catch (err: any) {
      toast.error(err?.message || t(effectiveLang, 'Failed to mark as read'));
    } finally {
      if (notification.url) {
        router.push(notification.url);
      }
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/login');
          return;
        }

        setUserId(user.id);
        pageRef.current = 0;
        rawOffsetRef.current = 0;
        setHasMore(true);

        const { data: businesses, error: businessError } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', user.id);
        if (businessError) throw businessError;
        const ownedIds = (businesses || []).map((row) => String((row as any).id));
        setOwnBusinessIds(ownedIds);

        const { visible, nextOffset, hasMore: more } = await fetchVisibleBatch(
          user.id,
          ownedIds,
          0,
          PAGE_SIZE
        );
        rawOffsetRef.current = nextOffset;
        setHasMore(more);
        setNotifications(visible.slice(0, PAGE_SIZE));
      } catch (err: any) {
        toast.error(err?.message || t(effectiveLang, 'Failed to load notifications'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  useEffect(() => {
    if (!userId || !hasMore) return;

    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (loadMoreLockRef.current || loadingMore || !hasMore) return;

        loadMoreLockRef.current = true;
        setLoadingMore(true);
        const nextPage = pageRef.current + 1;
        try {
          const { visible, nextOffset, hasMore: more } = await fetchVisibleBatch(
            userId,
            ownBusinessIds,
            rawOffsetRef.current,
            PAGE_SIZE
          );
          rawOffsetRef.current = nextOffset;
          setNotifications((prev) => [...prev, ...visible.slice(0, PAGE_SIZE)]);
          pageRef.current = nextPage;
          setHasMore(more);
        } catch (err: any) {
          toast.error(err?.message || t(effectiveLang, 'Failed to load notifications'));
        } finally {
          loadMoreLockRef.current = false;
          setLoadingMore(false);
        }
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [userId, hasMore, loadingMore]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur p-6 shadow-lg shadow-slate-100/70">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t(effectiveLang, 'Inbox')}</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{t(effectiveLang, 'Notifications')}</h1>
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {notifications.length} {t(effectiveLang, 'total')}
            </div>
          </div>

          {loading ? (
            <div className="mt-6 text-sm text-slate-500">{t(effectiveLang, 'Loading notifications...')}</div>
          ) : notifications.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center text-sm text-slate-600">
              {t(effectiveLang, 'No notifications yet.')}
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full rounded-2xl border px-5 py-4 text-left transition shadow-sm hover:-translate-y-0.5 hover:shadow-md ${
                    n.read_at
                      ? 'border-slate-200 bg-white'
                      : 'border-blue-200 bg-gradient-to-r from-blue-50 via-white to-white'
                  }`}
                >
                    <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {!n.read_at && <span className="mt-2 h-2 w-2 rounded-full bg-blue-500" />}
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                        {n.data?.business_name && (
                          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 mt-1">
                            {n.data.business_name}
                          </p>
                        )}
                          <span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                            {n.type === 'area_blast'
                              ? t(effectiveLang, 'Area Blast')
                              : n.type === 'area_blast_pending'
                              ? t(effectiveLang, 'Pending Approval')
                              : t(effectiveLang, 'Notification')}
                          </span>
                        <p className="mt-1 text-sm text-slate-600">{n.body}</p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-400 space-y-1">
                      <div>{new Date(n.created_at).toLocaleString()}</div>
                      {n.read_at && <div className="text-emerald-500">{t(effectiveLang, 'Read')}</div>}
                    </div>
                  </div>
                </button>
              ))}
              {loadingMore && (
                <div className="text-xs text-slate-500 text-center py-2">{t(effectiveLang, 'Loading more...')}</div>
              )}
              {hasMore && <div ref={sentinelRef} className="h-1 w-full" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
