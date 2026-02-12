'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle, XCircle, RefreshCw, Inbox, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type PromotionRequest = {
  id: string;
  business_id: string;
  business_name: string | null;
  business_slug: string | null;
  placement: string;
  image_path: string | null;
  image_url: string | null;
  link_type: string;
  link_value: string | null;
  description: string | null;
  tier: string;
  duration_days: number;
  price_cents: number;
  status: string;
  feed_banner_id: string | null;
  created_at: string;
};

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function AdminPromotionRequestsPage() {
  const [requests, setRequests] = useState<PromotionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const withAuth = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = statusFilter
        ? `/api/admin/promotion-requests?status=${encodeURIComponent(statusFilter)}`
        : '/api/admin/promotion-requests';
      const res = await fetch(url, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.requests)) {
        setRequests(data.requests);
      } else {
        setRequests([]);
      }
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') loadRequests();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [statusFilter]);

  const handleApprove = async (id: string) => {
    setProcessingRequestId(id);
    try {
      const res = await fetch('/api/admin/promotion-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await withAuth()) },
        body: JSON.stringify({ id, action: 'approve' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Approve failed');
      toast.success('Promotion approved; banner is now active in the feed.');
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingRequestId(id);
    try {
      const res = await fetch('/api/admin/promotion-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await withAuth()) },
        body: JSON.stringify({ id, action: 'reject' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Reject failed');
      toast.success('Promotion rejected.');
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending_review').length;

  return (
    <div className="max-w-5xl space-y-8">
      <Link
        href="/admin/dashboard"
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
          <Inbox className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Promotion Requests</h1>
          <p className="text-sm text-slate-500">
            Review submissions from &quot;Promote your business&quot;. Approve to add the banner to the feed; reject to decline.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">Requests</h2>
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => loadRequests()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {statusFilter === 'pending_review' && pendingCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                {pendingCount} pending
              </span>
            )}
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-slate-500">No requests match the selected filter.</p>
          ) : (
            <ul className="space-y-4">
              {requests.map((req) => (
                <li key={req.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex flex-wrap gap-4">
                    <div className="shrink-0">
                      {req.image_url ? (
                        <div className="w-40 h-24 rounded-lg overflow-hidden bg-white border border-slate-200">
                          <img src={req.image_url} alt={req.description || 'Banner'} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-40 h-24 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500 text-xs">No image</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{req.business_name ?? 'Unknown business'}</p>
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                          req.status === 'pending_review' ? 'bg-amber-100 text-amber-700' :
                          req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {req.status === 'pending_review' ? 'Pending' : req.status === 'approved' ? 'Approved' : 'Rejected'}
                        </span>
                      </div>
                      {req.business_slug && (
                        <Link
                          href={`/business/${req.business_slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-slate-500 hover:text-amber-600 inline-flex items-center gap-0.5"
                        >
                          /business/{req.business_slug}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      {req.description && (
                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">{req.description}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">
                        Link: {req.link_type === 'business_page' ? 'Business page' : req.link_value || '—'} · {req.tier} · {req.duration_days} days · ${(req.price_cents / 100).toFixed(0)}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{new Date(req.created_at).toLocaleString()}</p>
                      {req.status === 'pending_review' && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => handleApprove(req.id)}
                            disabled={processingRequestId === req.id || !req.image_path}
                            title={!req.image_path ? 'Cannot approve without banner image' : undefined}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <CheckCircle className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(req.id)}
                            disabled={processingRequestId === req.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </button>
                        </div>
                      )}
                      {req.status === 'approved' && req.feed_banner_id && (
                        <Link
                          href="/admin/feed-banners"
                          className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-amber-600 hover:text-amber-700"
                        >
                          View in Feed Banners
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
