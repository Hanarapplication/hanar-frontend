'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Flag,
  Eye,
  Archive,
  Trash2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  Filter,
  Send,
  ExternalLink,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAdminConfirm } from '@/components/AdminConfirmContext';
import { REPORT_ENTITY_LABEL, type ReportEntityType } from '@/lib/admin/reportTypes';

type Report = {
  id: string;
  entity_type: ReportEntityType;
  entity_id: string;
  entity_title: string;
  reporter_id: string;
  reporter_username: string;
  reason: string;
  details: string;
  status: 'unread' | 'read' | 'in_review' | 'need_attention' | 'archived' | 'resolved';
  admin_note: string;
  created_at: string;
  updated_at: string;
};

type ReportComment = {
  id: string;
  report_id: string;
  admin_email: string;
  body: string;
  created_at: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  unread: { label: 'Unread', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: <Clock className="h-3.5 w-3.5" /> },
  read: { label: 'Read', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200', icon: <Eye className="h-3.5 w-3.5" /> },
  in_review: { label: 'In review', color: 'text-blue-800', bg: 'bg-blue-50 border-blue-200', icon: <Search className="h-3.5 w-3.5" /> },
  need_attention: { label: 'Needs attention', color: 'text-orange-800', bg: 'bg-orange-50 border-orange-200', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  archived: { label: 'Archived', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', icon: <Archive className="h-3.5 w-3.5" /> },
  resolved: { label: 'Solved', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: <CheckCircle className="h-3.5 w-3.5" /> },
};

const ENTITY_LINK: Record<string, (id: string) => string> = {
  post: (id) => `/community/post/${id}`,
  item: (id) => `/marketplace/${id}`,
  business: (id) => `/business/${id}`,
  organization: (id) => `/organization/${id}`,
  chat: () => '/messages',
  seller: () => '/messages',
};

function refreshSidebarInboxCounts() {
  window.dispatchEvent(new Event('admin-inbox-counts-refresh'));
}

type AdminReportsPanelProps = {
  entityType: ReportEntityType;
  title: string;
  embedded?: boolean;
};

export default function AdminReportsPanel({ entityType, title, embedded = false }: AdminReportsPanelProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, ReportComment[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const { showConfirm } = useAdminConfirm();

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      params.set('entity_type', entityType);

      const res = await fetch(`/api/admin/reports?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load reports');
      setReports(data.reports || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filterStatus, entityType]);

  const fetchComments = async (reportId: string) => {
    if (comments[reportId]) return;
    setCommentLoading((prev) => ({ ...prev, [reportId]: true }));
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/reports/comments?report_id=${reportId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) => ({ ...prev, [reportId]: data.comments || [] }));
      }
    } finally {
      setCommentLoading((prev) => ({ ...prev, [reportId]: false }));
    }
  };

  const toggleExpand = (reportId: string) => {
    if (expandedReport === reportId) {
      setExpandedReport(null);
    } else {
      setExpandedReport(reportId);
      fetchComments(reportId);
    }
  };

  const updateStatus = async (reportId: string, status: string) => {
    setActionLoading((prev) => ({ ...prev, [reportId]: true }));
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id: reportId, status }),
      });
      if (res.ok) {
        setReports((prev) =>
          prev.map((r) =>
            r.id === reportId
              ? { ...r, status: status as Report['status'], updated_at: new Date().toISOString() }
              : r
          )
        );
        refreshSidebarInboxCounts();
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [reportId]: false }));
    }
  };

  const deleteReport = (reportId: string) => {
    showConfirm({
      title: 'Delete report?',
      message: 'Permanently delete this report? This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        setActionLoading((prev) => ({ ...prev, [reportId]: true }));
        try {
          const token = await getToken();
          const res = await fetch(`/api/admin/reports?id=${reportId}`, {
            method: 'DELETE',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            setReports((prev) => prev.filter((r) => r.id !== reportId));
            if (expandedReport === reportId) setExpandedReport(null);
            refreshSidebarInboxCounts();
          }
        } finally {
          setActionLoading((prev) => ({ ...prev, [reportId]: false }));
        }
      },
    });
  };

  const submitComment = async (reportId: string) => {
    const text = commentInputs[reportId]?.trim();
    if (!text) return;
    setCommentLoading((prev) => ({ ...prev, [reportId]: true }));
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ report_id: reportId, body: text }),
      });
      const data = await res.json();
      if (res.ok && data.comment) {
        setComments((prev) => ({
          ...prev,
          [reportId]: [...(prev[reportId] || []), data.comment],
        }));
        setCommentInputs((prev) => ({ ...prev, [reportId]: '' }));
      }
    } finally {
      setCommentLoading((prev) => ({ ...prev, [reportId]: false }));
    }
  };

  const needsAttentionCount = reports.filter((r) =>
    ['unread', 'read', 'in_review', 'need_attention'].includes(r.status)
  ).length;

  return (
    <div className={embedded ? '' : 'max-w-5xl'}>
      {!embedded ? (
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inbox · Reports</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900">
              <Flag className="h-6 w-6 text-red-500" />
              {title}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {needsAttentionCount > 0
                ? `${needsAttentionCount} report${needsAttentionCount > 1 ? 's' : ''} in queue (unread, read, in review, or needs attention)`
                : `Review and manage ${REPORT_ENTITY_LABEL[entityType].toLowerCase()} reports`}
              {!loading ? ` · ${reports.length} received` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={fetchReports}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      ) : null}

      <div className={`flex flex-wrap items-center gap-3 ${embedded ? 'mb-4' : 'mb-6'}`}>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-600">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-200"
          >
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
            <option value="in_review">In review</option>
            <option value="need_attention">Needs attention</option>
            <option value="archived">Archived</option>
            <option value="resolved">Solved</option>
          </select>
        </div>
        <div className="ml-auto text-sm text-slate-500">
          {reports.length} report{reports.length !== 1 ? 's' : ''}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <Flag className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-500">No reports found</p>
          <p className="mt-1 text-sm text-slate-400">Adjust filters or check back later.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const statusConf = STATUS_CONFIG[report.status] || {
              label: report.status,
              color: 'text-slate-600',
              bg: 'bg-slate-100 border-slate-200',
              icon: <Flag className="h-3.5 w-3.5" />,
            };
            const isExpanded = expandedReport === report.id;
            const isLoading = actionLoading[report.id];
            const reportComments = comments[report.id] || [];

            return (
              <div
                key={report.id}
                className={`rounded-xl border bg-white transition-all ${
                  report.status === 'unread' || report.status === 'need_attention'
                    ? 'border-amber-200 shadow-sm'
                    : 'border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(report.id)}
                  className="flex w-full items-center gap-4 rounded-xl p-4 text-left transition hover:bg-slate-50/50"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${statusConf.bg} ${statusConf.color}`}>
                    <Flag className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-slate-900">
                        {report.entity_title || `${REPORT_ENTITY_LABEL[report.entity_type]} #${report.entity_id.slice(0, 8)}`}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusConf.bg} ${statusConf.color}`}>
                        {statusConf.icon}
                        {statusConf.label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                      <span>
                        Reason: <span className="font-medium text-slate-700">{report.reason}</span>
                      </span>
                      <span>·</span>
                      <span>
                        By: {report.reporter_username ? `@${report.reporter_username}` : report.reporter_id.slice(0, 8)}
                      </span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 flex-shrink-0 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 flex-shrink-0 text-slate-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                    {report.details && (
                      <div className="mb-4 rounded-lg bg-slate-50 p-3">
                        <p className="mb-1 text-xs font-medium text-slate-500">Additional Details</p>
                        <p className="text-sm text-slate-700">{report.details}</p>
                      </div>
                    )}

                    <div className="mb-4">
                      {report.entity_type === 'seller' ? (
                        <p className="text-sm text-slate-600">
                          <span className="font-medium text-slate-700">Reported user (seller) ID: </span>
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">{report.entity_id}</code>
                        </p>
                      ) : (
                        <a
                          href={ENTITY_LINK[report.entity_type]?.(report.entity_id) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-rose-600 hover:text-rose-700 hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          View reported {REPORT_ENTITY_LABEL[report.entity_type] || report.entity_type}
                        </a>
                      )}
                    </div>

                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      {report.status !== 'read' && (
                        <button
                          type="button"
                          onClick={() => updateStatus(report.id, 'read')}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Mark as read
                        </button>
                      )}
                      {report.status !== 'in_review' && (
                        <button
                          type="button"
                          onClick={() => updateStatus(report.id, 'in_review')}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 transition hover:bg-blue-100 disabled:opacity-50"
                        >
                          <Search className="h-3.5 w-3.5" />
                          In review
                        </button>
                      )}
                      {report.status !== 'need_attention' && (
                        <button
                          type="button"
                          onClick={() => updateStatus(report.id, 'need_attention')}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800 transition hover:bg-orange-100 disabled:opacity-50"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Needs attention
                        </button>
                      )}
                      {report.status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => updateStatus(report.id, 'resolved')}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Solved
                        </button>
                      )}
                      {report.status !== 'archived' && (
                        <button
                          type="button"
                          onClick={() => updateStatus(report.id, 'archived')}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          Archive
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteReport(report.id)}
                        disabled={isLoading}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                      <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Admin Comments
                      </h4>

                      {commentLoading[report.id] && reportComments.length === 0 ? (
                        <p className="text-xs text-slate-400">Loading comments...</p>
                      ) : reportComments.length === 0 ? (
                        <p className="mb-3 text-xs text-slate-400">No comments yet.</p>
                      ) : (
                        <div className="mb-3 space-y-2">
                          {reportComments.map((comment) => (
                            <div key={comment.id} className="rounded-lg bg-slate-50 px-3 py-2">
                              <div className="flex items-center justify-between text-xs text-slate-500">
                                <span className="font-medium">{comment.admin_email}</span>
                                <span>{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
                              </div>
                              <p className="mt-1 text-sm text-slate-700">{comment.body}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          value={commentInputs[report.id] || ''}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({ ...prev, [report.id]: e.target.value }))
                          }
                          placeholder="Add a comment..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              submitComment(report.id);
                            }
                          }}
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                        />
                        <button
                          type="button"
                          onClick={() => submitComment(report.id)}
                          disabled={!commentInputs[report.id]?.trim() || commentLoading[report.id]}
                          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
