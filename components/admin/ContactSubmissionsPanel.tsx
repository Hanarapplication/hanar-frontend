'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, FileText, Loader2, Mail, Phone } from 'lucide-react';

type InboxStatus = 'pending' | 'reviewed' | 'closed';

type BusinessSummary = {
  id: string;
  business_name: string;
  slug: string;
  phone?: string | null;
  email?: string | null;
  owner_id?: string | null;
  claim_status?: string | null;
  admin_added_at?: string | null;
};

export type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  business_id: string | null;
  business_name: string | null;
  business_slug: string | null;
  source: string;
  status: InboxStatus;
  created_at: string;
  businesses: BusinessSummary | BusinessSummary[] | null;
};

function getBusiness(row: ContactSubmission): BusinessSummary | null {
  const b = row.businesses;
  if (!b) return null;
  return Array.isArray(b) ? b[0] ?? null : b;
}

function refreshSidebarInboxCounts() {
  window.dispatchEvent(new Event('admin-inbox-counts-refresh'));
}

type ContactSubmissionsPanelProps = {
  source: 'contact' | 'business_claim';
  description?: string;
  embedded?: boolean;
};

export default function ContactSubmissionsPanel({
  source,
  description,
  embedded = false,
}: ContactSubmissionsPanelProps) {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'reviewed' | 'closed' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error('Not authenticated');
        return;
      }
      const res = await fetch(
        `/api/admin/inbox/contact?status=${statusFilter}&source=${source}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to load submissions');
        return;
      }
      setSubmissions(data.submissions || []);
    } finally {
      setLoading(false);
    }
  }, [source, statusFilter]);

  useEffect(() => {
    void fetchSubmissions();
  }, [fetchSubmissions]);

  async function updateStatus(submissionId: string, status: InboxStatus) {
    setActingId(submissionId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/admin/inbox/contact/${submissionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Update failed');
        return;
      }
      toast.success('Updated');
      await fetchSubmissions();
      refreshSidebarInboxCounts();
    } catch {
      toast.error('Update failed');
    } finally {
      setActingId(null);
    }
  }

  const showBusinessContext = source === 'business_claim';

  return (
    <div>
      {description ? (
        <p className={`text-sm text-slate-600 dark:text-slate-300 ${embedded ? 'mb-4' : 'mb-6'}`}>
          {description}
        </p>
      ) : null}

      <div className={`flex flex-wrap items-center gap-2 ${embedded ? 'mb-4' : 'mb-6'}`}>
        {(['pending', 'reviewed', 'closed', 'all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition ${
              statusFilter === s
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {s}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void fetchSubmissions()}
          className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          No {statusFilter === 'all' ? '' : statusFilter} submissions.
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub) => {
            const biz = getBusiness(sub);
            const slug = sub.business_slug || biz?.slug;
            const isPending = sub.status === 'pending';
            const title =
              showBusinessContext && (sub.business_name || biz?.business_name)
                ? sub.business_name || biz?.business_name || 'Unknown business'
                : sub.subject;

            return (
              <article
                key={sub.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5"
              >
                <SubmissionHeader
                  title={title}
                  status={sub.status}
                  badge={showBusinessContext ? 'Business claim' : 'Contact us'}
                  slug={showBusinessContext ? slug : null}
                  createdAt={sub.created_at}
                />

                {isPending ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={actingId === sub.id}
                      onClick={() => updateStatus(sub.id, 'reviewed')}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Mark reviewed
                    </button>
                    <button
                      type="button"
                      disabled={actingId === sub.id}
                      onClick={() => updateStatus(sub.id, 'closed')}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sub.status !== 'pending' ? (
                      <button
                        type="button"
                        disabled={actingId === sub.id}
                        onClick={() => updateStatus(sub.id, 'pending')}
                        className="rounded-lg border border-amber-200 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-60"
                      >
                        Reopen
                      </button>
                    ) : null}
                  </div>
                )}

                <div className={`mt-4 grid gap-4 ${showBusinessContext ? 'sm:grid-cols-2' : ''}`}>
                  <InfoPanel title="From">
                    <p className="font-medium text-slate-900 dark:text-white" data-no-translate>
                      {sub.name}
                    </p>
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                      <Mail size={14} />
                      <a href={`mailto:${sub.email}`} className="hover:underline">
                        {sub.email}
                      </a>
                    </p>
                    {sub.phone ? (
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                        <Phone size={14} />
                        <a href={`tel:${sub.phone}`} className="hover:underline">
                          {sub.phone}
                        </a>
                      </p>
                    ) : null}
                    {!showBusinessContext ? (
                      <p className="mt-2 text-xs text-slate-500">Subject: {sub.subject}</p>
                    ) : null}
                  </InfoPanel>
                  {showBusinessContext ? <ListingPanel biz={biz} /> : null}
                </div>

                <MessagePanel text={sub.message} />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SubmissionHeader({
  title,
  status,
  badge,
  slug,
  createdAt,
}: {
  title: string;
  status: string;
  badge: string;
  slug?: string | null;
  createdAt: string;
}) {
  const statusClass =
    status === 'pending'
      ? 'bg-amber-100 text-amber-800'
      : status === 'reviewed'
        ? 'bg-emerald-100 text-emerald-800'
        : 'bg-slate-200 text-slate-700';

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white" data-no-translate>
          {title}
        </h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${statusClass}`}>
          {status}
        </span>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{badge}</span>
      </div>
      {slug ? (
        <Link
          href={`/business/${slug}`}
          target="_blank"
          className="mt-1 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
        >
          View listing <ExternalLink size={13} />
        </Link>
      ) : null}
      <p className="mt-2 text-xs text-slate-500">
        Received {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
      </p>
    </div>
  );
}

function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ListingPanel({ biz }: { biz: BusinessSummary | null }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Listing</p>
      {biz?.phone ? (
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{biz.phone}</p>
      ) : (
        <p className="mt-1 text-sm text-slate-400">No phone on listing</p>
      )}
      {biz?.email ? (
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{biz.email}</p>
      ) : (
        <p className="mt-1 text-sm text-slate-400">No email on listing</p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Claim status: {biz?.claim_status || '—'} · Owner: {biz?.owner_id ? 'assigned' : 'none'}
        {biz?.admin_added_at ? ' · Admin-added' : ''}
      </p>
    </div>
  );
}

function MessagePanel({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <FileText size={14} /> Message
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{text}</p>
    </div>
  );
}
