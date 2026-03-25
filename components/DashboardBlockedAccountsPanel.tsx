'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Ban } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Avatar } from '@/components/Avatar';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

export type DashboardBlockListEntry = {
  userId: string;
  username: string | null;
  displayName: string | null;
  isOrganization: boolean;
  avatarUrl: string | null;
  direction: 'outgoing' | 'incoming';
};

type Props = {
  /** When false, skips fetch (e.g. parent still verifying auth) */
  ready?: boolean;
  /** Card wrapper Tailwind classes */
  className?: string;
};

export function DashboardBlockedAccountsPanel({ ready = true, className }: Props) {
  const { effectiveLang } = useLanguage();
  const [blockList, setBlockList] = useState<DashboardBlockListEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        const res = await fetch('/api/user/blocks', { credentials: 'include', headers });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setBlockList([]);
          return;
        }
        const out = (data.outgoing || []).map((e: DashboardBlockListEntry) => ({ ...e, direction: 'outgoing' as const }));
        const inc = (data.incoming || []).map((e: DashboardBlockListEntry) => ({ ...e, direction: 'incoming' as const }));
        setBlockList([...out, ...inc]);
      } catch {
        if (!cancelled) setBlockList([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const unblockUser = async (blockedUserId: string) => {
    if (unblockingId) return;
    setUnblockingId(blockedUserId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch(`/api/user/blocks?blockedUserId=${encodeURIComponent(blockedUserId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });
      if (!res.ok) {
        toast.error(t(effectiveLang, 'Could not unblock'));
        return;
      }
      setBlockList((prev) => prev.filter((e) => !(e.direction === 'outgoing' && e.userId === blockedUserId)));
      toast.success(t(effectiveLang, 'Unblocked'));
    } finally {
      setUnblockingId(null);
    }
  };

  const shell =
    className ||
    'rounded-3xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg shadow-slate-100/60 dark:shadow-black/20 p-6 sm:p-8';

  return (
    <div className={shell}>
      <div className="mb-2 flex items-center gap-2">
        <Ban className="h-5 w-5 text-slate-500 dark:text-gray-400" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100">{t(effectiveLang, 'Blocked accounts')}</h2>
      </div>
      <p className="mb-4 text-sm text-slate-500 dark:text-gray-400">
        {t(
          effectiveLang,
          'Accounts you blocked cannot see your community posts or interact with you. If someone blocked you, only they can undo it from their dashboard.',
        )}
      </p>
      {loading ? (
        <p className="text-sm text-slate-500 dark:text-gray-400">{t(effectiveLang, 'Loading...')}</p>
      ) : blockList.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-gray-400">{t(effectiveLang, 'No blocked accounts.')}</p>
      ) : (
        <ul className="space-y-3">
          {blockList.map((entry) => {
            const label = entry.displayName || entry.username || entry.userId;
            const href =
              entry.isOrganization && entry.username
                ? `/organization/${entry.username}`
                : entry.username
                  ? `/profile/${entry.username}`
                  : null;
            return (
              <li
                key={`${entry.direction}-${entry.userId}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-gray-600 dark:bg-gray-700/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar src={entry.avatarUrl || undefined} alt="" className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="min-w-0">
                    {href ? (
                      <Link
                        href={href}
                        className="block truncate font-medium text-slate-900 hover:text-indigo-600 dark:text-gray-100 dark:hover:text-indigo-400"
                      >
                        {label}
                      </Link>
                    ) : (
                      <span className="block truncate font-medium text-slate-900 dark:text-gray-100">{label}</span>
                    )}
                    <span className="text-xs text-slate-500 dark:text-gray-400">
                      {entry.isOrganization ? t(effectiveLang, 'Organization') : t(effectiveLang, 'Individual')}
                      {entry.direction === 'incoming'
                        ? ` · ${t(effectiveLang, 'Blocked you')}`
                        : ` · ${t(effectiveLang, 'You blocked')}`}
                    </span>
                  </div>
                </div>
                {entry.direction === 'outgoing' ? (
                  <button
                    type="button"
                    onClick={() => unblockUser(entry.userId)}
                    disabled={unblockingId === entry.userId}
                    className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-50 dark:border-gray-500 dark:text-gray-200 dark:hover:bg-gray-600"
                  >
                    {unblockingId === entry.userId ? t(effectiveLang, 'Saving...') : t(effectiveLang, 'Unblock')}
                  </button>
                ) : (
                  <span className="shrink-0 text-xs text-slate-400 dark:text-gray-500">{t(effectiveLang, '—')}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
