'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { useAdminConfirm } from '@/components/AdminConfirmContext';
import ContactSubmissionsPanel from '@/components/admin/ContactSubmissionsPanel';
import { ExternalLink, Loader2, Mail, FileText, Phone, ShieldCheck } from 'lucide-react';

type ClaimStatus = 'pending' | 'approved' | 'rejected';
type Tab = 'email_claims' | 'contact_form';

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

type BusinessClaim = {
  id: string;
  business_id: string;
  user_id: string | null;
  claim_name: string;
  claim_phone: string | null;
  claim_email: string | null;
  proof_text: string;
  proof_image_url: string | null;
  status: ClaimStatus;
  phone_verified: boolean;
  email_verified?: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  businesses: BusinessSummary | BusinessSummary[] | null;
};

async function getAdminToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function getBusiness<T extends { businesses?: BusinessSummary | BusinessSummary[] | null }>(
  row: T
): BusinessSummary | null {
  const b = row.businesses;
  if (!b) return null;
  return Array.isArray(b) ? b[0] ?? null : b;
}

function refreshSidebarInboxCounts() {
  window.dispatchEvent(new Event('admin-inbox-counts-refresh'));
}

export default function AdminInboxBusinessClaimsPage() {
  const [tab, setTab] = useState<Tab>('email_claims');
  const [claims, setClaims] = useState<BusinessClaim[]>([]);
  const [claimFilter, setClaimFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [pendingContactClaimCount, setPendingContactClaimCount] = useState(0);
  const { showConfirm } = useAdminConfirm();

  const fetchClaims = useCallback(async () => {
    const token = await getAdminToken();
    if (!token) {
      toast.error('Not authenticated');
      return;
    }
    const res = await fetch(`/api/admin/business-claims?status=${claimFilter}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Failed to load claims');
      return;
    }
    setClaims(data.claims || []);
  }, [claimFilter]);

  const fetchCounts = useCallback(async () => {
    const token = await getAdminToken();
    if (!token) return;
    const res = await fetch('/api/admin/inbox/counts', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    setPendingContactClaimCount(data.pendingContactForm ?? 0);
  }, []);

  useEffect(() => {
    setLoading(true);
    void fetchClaims().finally(() => setLoading(false));
  }, [fetchClaims]);

  useEffect(() => {
    void fetchCounts();
    const onRefresh = () => {
      void fetchCounts();
    };
    window.addEventListener('admin-inbox-counts-refresh', onRefresh);
    return () => window.removeEventListener('admin-inbox-counts-refresh', onRefresh);
  }, [fetchCounts]);

  const pendingClaimCount = useMemo(
    () => claims.filter((c) => c.status === 'pending').length,
    [claims]
  );

  async function performReview(claimId: string, action: 'approve' | 'reject') {
    setActingId(claimId);
    try {
      const token = await getAdminToken();
      const res = await fetch(`/api/admin/business-claims/${claimId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Action failed');
        return;
      }
      toast.success(action === 'approve' ? 'Claim approved' : 'Claim rejected');
      await fetchClaims();
      refreshSidebarInboxCounts();
    } catch {
      toast.error('Action failed');
    } finally {
      setActingId(null);
    }
  }

  function reviewClaim(claimId: string, action: 'approve' | 'reject') {
    const claim = claims.find((c) => c.id === claimId);
    const biz = claim ? getBusiness(claim) : null;
    const label = biz?.business_name || 'this business';

    showConfirm({
      title: action === 'approve' ? 'Approve claim' : 'Reject claim',
      message:
        action === 'approve'
          ? `Assign ${claim?.claim_name} as owner of "${label}"?`
          : `Reject the claim from ${claim?.claim_name} for "${label}"?`,
      confirmLabel: action === 'approve' ? 'Approve' : 'Reject',
      variant: action === 'reject' ? 'danger' : 'default',
      onConfirm: () => {
        void performReview(claimId, action);
      },
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inbox</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Business claims</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Review email-verified claims and contact-form requests for businesses without an email on file.
          Approving an email claim assigns <code className="text-xs">owner_id</code>.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setTab('email_claims')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === 'email_claims'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
          }`}
        >
          <ShieldCheck size={16} />
          Email claims
          {pendingClaimCount > 0 ? (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950">
              {pendingClaimCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setTab('contact_form')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === 'contact_form'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
          }`}
        >
          <Mail size={16} />
          Contact form
          {pendingContactClaimCount > 0 ? (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950">
              {pendingContactClaimCount}
            </span>
          ) : null}
        </button>
      </div>

      {tab === 'email_claims' ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setClaimFilter(s)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition ${
                  claimFilter === s
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {loading ? (
            <LoadingState />
          ) : claims.length === 0 ? (
            <EmptyState label={`No ${claimFilter === 'all' ? '' : claimFilter} email claims.`} />
          ) : (
            <div className="space-y-4">
              {claims.map((claim) => {
                const biz = getBusiness(claim);
                const isPending = claim.status === 'pending';
                return (
                  <article
                    key={claim.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5"
                  >
                    <ClaimHeader
                      title={biz?.business_name || 'Unknown business'}
                      status={claim.status}
                      badge={claim.email_verified ? 'Email verified' : claim.phone_verified ? 'Phone verified' : null}
                      slug={biz?.slug}
                      createdAt={claim.created_at}
                    />
                    {isPending ? (
                      <div className="mt-3 flex shrink-0 gap-2">
                        <button
                          type="button"
                          disabled={actingId === claim.id}
                          onClick={() => reviewClaim(claim.id, 'reject')}
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={actingId === claim.id || !claim.user_id}
                          onClick={() => reviewClaim(claim.id, 'approve')}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {actingId === claim.id ? 'Working…' : 'Approve & assign owner'}
                        </button>
                      </div>
                    ) : claim.reviewed_at ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Reviewed {formatDistanceToNow(new Date(claim.reviewed_at), { addSuffix: true })}
                      </p>
                    ) : null}

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <InfoPanel title="Claimant">
                        <p className="font-medium text-slate-900 dark:text-white" data-no-translate>
                          {claim.claim_name}
                        </p>
                        {claim.claim_phone ? (
                          <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                            <Phone size={14} /> {claim.claim_phone}
                          </p>
                        ) : null}
                        {claim.claim_email ? (
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                            <Mail size={14} /> {claim.claim_email}
                          </p>
                        ) : null}
                        {claim.user_id ? (
                          <p className="mt-2 text-xs text-slate-400">User ID: {claim.user_id}</p>
                        ) : (
                          <p className="mt-2 text-xs text-amber-700">No linked user account</p>
                        )}
                      </InfoPanel>
                      <ListingPanel biz={biz} />
                    </div>

                    <ProofPanel text={claim.proof_text} fileUrl={claim.proof_image_url} />
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <ContactSubmissionsPanel
          source="business_claim"
          embedded
          description="Claim requests submitted via the contact form when a listing has no email on file. Contact the person, then assign ownership from Business Approvals."
        />
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16 text-slate-500">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900">
      {label}
    </div>
  );
}

function ClaimHeader({
  title,
  status,
  badge,
  slug,
  createdAt,
}: {
  title: string;
  status: string;
  badge: string | null;
  slug?: string | null;
  createdAt: string;
}) {
  const statusClass =
    status === 'pending'
      ? 'bg-amber-100 text-amber-800'
      : status === 'approved' || status === 'reviewed'
        ? 'bg-emerald-100 text-emerald-800'
        : status === 'rejected' || status === 'closed'
          ? 'bg-slate-200 text-slate-700'
          : 'bg-slate-100 text-slate-700';

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white" data-no-translate>
          {title}
        </h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${statusClass}`}>
          {status}
        </span>
        {badge ? (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{badge}</span>
        ) : null}
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

function ProofPanel({ text, fileUrl }: { text: string; fileUrl?: string | null }) {
  return (
    <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <FileText size={14} /> Message / proof
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{text}</p>
      {fileUrl ? (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
        >
          View uploaded document <ExternalLink size={13} />
        </a>
      ) : null}
    </div>
  );
}
