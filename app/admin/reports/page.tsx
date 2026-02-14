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
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAdminConfirm } from '@/components/AdminConfirmContext';

type Report = {
  id: string;
  entity_type: 'post' | 'item' | 'business' | 'organization';
  entity_id: string;
  entity_title: string;
  reporter_id: string;
  reporter_username: string;
  reason: string;
  details: string;
  status: 'unread' | 'read' | 'archived' | 'resolved';
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
  read: { label: 'Read', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: <Eye className="h-3.5 w-3.5" /> },
  archived: { label: 'Archived', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', icon: <Archive className="h-3.5 w-3.5" /> },
  resolved: { label: 'Resolved', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: <CheckCircle className="h-3.5 w-3.5" /> },
};

const ENTITY_LABEL: Record<string, string> = {
  post: 'Post',
  item: 'Marketplace Item',
  business: 'Business',
  organization: 'Organization',
};

const ENTITY_LINK: Record<string, (id: string) => string> = {
  post: (id) => `/community/post/${id}`,
  item: (id) => `/marketplace/${id}`,
  business: (id) => `/business/${id}`,
  organization: (id) => `/organization/${id}`,
};

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
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
      if (filterType !== 'all') params.set('entity_type', filterType);

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
  }, [filterStatus, filterType]);

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
          prev.map((r) => (r.id === reportId ? { ...r, status: status as Report['status'], updated_at: new Date().toISOString() } : r))
        );
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

  const unreadCount = reports.filter((r) => r.status === 'unread').length;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Flag className="h-6 w-6 text-red-500" />
            Reports
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {unreadCount > 0
              ? `${unreadCount} unread report${unreadCount > 1 ? 's' : ''} need attention`
              : 'Review and manage user reports'}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchReports}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-600">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
            <option value="archived">Archived</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Type:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="all">All</option>
            <option value="post">Posts</option>
            <option value="item">Marketplace Items</option>
            <option value="business">Businesses</option>
            <option value="organization">Organizations</option>
          </select>
        </div>
        <div className="text-sm text-slate-500 ml-auto">
          {reports.length} report{reports.length !== 1 ? 's' : ''}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-slate-100 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded bg-slate-100 animate-pulse" />
                  <div className="h-3 w-32 rounded bg-slate-100 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <Flag className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No reports found</p>
          <p className="text-sm text-slate-400 mt-1">Adjust filters or check back later.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const statusConf = STATUS_CONFIG[report.status] || STATUS_CONFIG.unread;
            const isExpanded = expandedReport === report.id;
            const isLoading = actionLoading[report.id];
            const reportComments = comments[report.id] || [];

            return (
              <div
                key={report.id}
                className={`rounded-xl border bg-white transition-all ${
                  report.status === 'unread'
                    ? 'border-amber-200 shadow-sm'
                    : 'border-slate-200'
                }`}
              >
                {/* Header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(report.id)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-50/50 transition rounded-xl"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${statusConf.bg} border ${statusConf.color}`}>
                    <Flag className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 truncate">
                        {report.entity_title || `${ENTITY_LABEL[report.entity_type]} #${report.entity_id.slice(0, 8)}`}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${statusConf.bg} ${statusConf.color}`}>
                        {statusConf.icon}
                        {statusConf.label}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {ENTITY_LABEL[report.entity_type]}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                      <span>Reason: <span className="font-medium text-slate-700">{report.reason}</span></span>
                      <span>·</span>
                      <span>
                        By: {report.reporter_username ? `@${report.reporter_username}` : report.reporter_id.slice(0, 8)}
                      </span>
                      <span>·</span>
                      <span>
                        {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="h-5 w-5 text-slate-400 flex-shrink-0" />}
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                    {/* Details */}
                    {report.details && (
                      <div className="mb-4 rounded-lg bg-slate-50 p-3">
                        <p className="text-xs font-medium text-slate-500 mb-1">Additional Details</p>
                        <p className="text-sm text-slate-700">{report.details}</p>
                      </div>
                    )}

                    {/* Link to entity */}
                    <div className="mb-4">
                      <a
                        href={ENTITY_LINK[report.entity_type]?.(report.entity_id) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View reported {report.entity_type}
                      </a>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      {report.status !== 'read' && (
                        <button
                          type="button"
                          onClick={() => updateStatus(report.id, 'read')}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Mark as Read
                        </button>
                      )}
                      {report.status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => updateStatus(report.id, 'resolved')}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50 transition"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Resolve
                        </button>
                      )}
                      {report.status !== 'archived' && (
                        <button
                          type="button"
                          onClick={() => updateStatus(report.id, 'archived')}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          Archive
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteReport(report.id)}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 transition ml-auto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>

                    {/* Comments Section */}
                    <div className="border-t border-slate-100 pt-3">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Admin Comments
                      </h4>

                      {commentLoading[report.id] && reportComments.length === 0 ? (
                        <p className="text-xs text-slate-400">Loading comments...</p>
                      ) : reportComments.length === 0 ? (
                        <p className="text-xs text-slate-400 mb-3">No comments yet.</p>
                      ) : (
                        <div className="space-y-2 mb-3">
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
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
                        />
                        <button
                          type="button"
                          onClick={() => submitComment(report.id)}
                          disabled={!commentInputs[report.id]?.trim() || commentLoading[report.id]}
                          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
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
