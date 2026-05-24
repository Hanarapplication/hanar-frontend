'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Flag } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import AdminReportsPanel from '@/components/admin/AdminReportsPanel';
import { REPORT_INBOX_NAV, type ReportEntityType } from '@/lib/admin/reportTypes';

type InboxCounts = {
  reportsByType: Record<string, number>;
  reportsByTypeTotal: Record<string, number>;
  reportsTotal: number;
  reports: number;
};

function TypeCountBadge({ total, unread }: { total: number; unread: number }) {
  if (total <= 0) {
    return <span className="text-xs text-slate-400">0 received</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
        {total} received
      </span>
      {unread > 0 ? (
        <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950">
          {unread} unread
        </span>
      ) : null}
    </div>
  );
}

export default function AdminReportsInbox() {
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<InboxCounts | null>(null);

  const fetchCounts = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch('/api/admin/inbox/counts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setCounts((await res.json()) as InboxCounts);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchCounts();
    const onRefresh = () => {
      void fetchCounts();
    };
    window.addEventListener('admin-inbox-counts-refresh', onRefresh);
    return () => window.removeEventListener('admin-inbox-counts-refresh', onRefresh);
  }, [fetchCounts]);

  const toggleType = (slug: ReportEntityType) => {
    setExpandedTypes((prev) => ({ ...prev, [slug]: !prev[slug] }));
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inbox</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Flag className="h-6 w-6 text-red-500" />
          Reports
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {counts
            ? `${counts.reportsTotal} report${counts.reportsTotal !== 1 ? 's' : ''} received`
            : 'Review user reports by type'}
          {counts && counts.reports > 0 ? ` · ${counts.reports} unread` : ''}
        </p>
      </div>

      <div className="space-y-3">
        {REPORT_INBOX_NAV.map((entry) => {
          const total = counts?.reportsByTypeTotal?.[entry.slug] ?? 0;
          const unread = counts?.reportsByType?.[entry.slug] ?? 0;
          const isOpen = expandedTypes[entry.slug] ?? false;

          return (
            <section
              key={entry.slug}
              className={`overflow-hidden rounded-xl border bg-white transition-colors ${
                unread > 0 ? 'border-amber-200' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleType(entry.slug)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-4 text-left transition hover:bg-slate-50/80"
                  aria-expanded={isOpen}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <span className="font-semibold text-slate-900">{entry.label}</span>
                    <TypeCountBadge total={total} unread={unread} />
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
                  )}
                </button>
                <Link
                  href={`/admin/inbox/reports/${entry.slug}`}
                  className="mr-4 shrink-0 text-xs font-medium text-indigo-600 hover:underline"
                >
                  Open full view
                </Link>
              </div>

              {isOpen ? (
                <div className="border-t border-slate-100 px-4 pb-4 pt-2">
                  <AdminReportsPanel entityType={entry.slug} title={entry.label} embedded />
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
