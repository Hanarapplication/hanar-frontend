'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ImagePlus,
  Trash2,
  ExternalLink,
  Clock,
  Archive,
  Pause,
  CalendarPlus,
  Package,
  Pencil,
  Download,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type Banner = {
  id: string;
  image_path: string;
  image: string;
  link_url: string;
  alt: string;
  status: string;
  expires_at: string | null;
  starts_at: string | null;
  duration_days: number | null;
  package_id: string | null;
  created_at: string;
};

type BannerPackage = {
  id: string;
  name: string;
  duration_days: number;
  sort_order: number;
};

type BannerComment = {
  id: string;
  body: string;
  author: string | null;
  created_at: string;
};

function formatCountdown(expiresAt: string | null): string {
  if (!expiresAt) return 'No expiry';
  const end = new Date(expiresAt).getTime();
  const now = Date.now();
  if (end <= now) return 'Expired';
  const d = Math.floor((end - now) / (24 * 60 * 60 * 1000));
  const h = Math.floor(((end - now) % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h left`;
  const m = Math.floor(((end - now) % (60 * 60 * 1000)) / 60000);
  return `${m}m left`;
}

export default function AdminFeedBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [packages, setPackages] = useState<BannerPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'on_hold' | 'archived'>('all');
  const [linkUrl, setLinkUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [packageId, setPackageId] = useState<string>('');
  const [customDays, setCustomDays] = useState<string>('');
  const [extendBannerId, setExtendBannerId] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState<string>('30');
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [editLinkUrl, setEditLinkUrl] = useState('');
  const [editAlt, setEditAlt] = useState('');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [addBannerExpanded, setAddBannerExpanded] = useState(false);
  const [commentsExpandedId, setCommentsExpandedId] = useState<string | null>(null);
  const [commentsByBannerId, setCommentsByBannerId] = useState<Record<string, BannerComment[]>>({});
  const [commentsLoadingId, setCommentsLoadingId] = useState<string | null>(null);
  const [newCommentByBannerId, setNewCommentByBannerId] = useState<Record<string, string>>({});
  const [postingCommentId, setPostingCommentId] = useState<string | null>(null);

  const loadComments = async (bannerId: string) => {
    setCommentsLoadingId(bannerId);
    try {
      const res = await fetch(`/api/admin/feed-banners/comments?banner_id=${encodeURIComponent(bannerId)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.comments)) {
        setCommentsByBannerId((prev) => ({ ...prev, [bannerId]: data.comments }));
      }
    } catch {
      toast.error('Failed to load comments');
    } finally {
      setCommentsLoadingId(null);
    }
  };

  const addComment = async (bannerId: string) => {
    const text = (newCommentByBannerId[bannerId] ?? '').trim();
    if (!text) return;
    setPostingCommentId(bannerId);
    try {
      const res = await fetch('/api/admin/feed-banners/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banner_id: bannerId, body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to add comment');
      setNewCommentByBannerId((prev) => ({ ...prev, [bannerId]: '' }));
      const newComment = data.comment as BannerComment;
      setCommentsByBannerId((prev) => ({
        ...prev,
        [bannerId]: [...(prev[bannerId] || []), newComment],
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setPostingCommentId(null);
    }
  };

  const loadBanners = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `/api/admin/feed-banners?status=${statusFilter}&_t=${Date.now()}`,
        {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
          cache: 'no-store',
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBanners(data.banners || []);
        setPackages(data.packages || []);
      } else {
        setBanners([]);
      }
    } catch {
      setBanners([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBanners();
  }, [statusFilter]);

  // Refetch when page becomes visible (e.g. after another tab) so data stays updated
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') loadBanners();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [statusFilter]);

  const withAuth = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !linkUrl.trim()) {
      toast.error('Select an image and enter a link URL');
      return;
    }
    const form = new FormData();
    form.set('image', file);
    form.set('link_url', linkUrl.trim());
    form.set('alt', alt.trim());
    if (packageId) form.set('package_id', packageId);
    if (customDays.trim()) form.set('duration_days', customDays.trim());
    setUploading(true);
    try {
      const res = await fetch('/api/admin/feed-banners', {
        method: 'POST',
        headers: await withAuth(),
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      toast.success('Banner added');
      setFile(null);
      setLinkUrl('');
      setAlt('');
      setPackageId('');
      setCustomDays('');
      loadBanners();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleStatus = async (id: string, status: 'active' | 'on_hold' | 'archived') => {
    setUpdatingId(id);
    try {
      const res = await fetch('/api/admin/feed-banners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await withAuth()) },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Update failed');
      toast.success(`Banner ${status === 'on_hold' ? 'on hold' : status}`);
      loadBanners();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleExtend = async (id: string) => {
    const days = parseInt(extendDays, 10);
    if (!days || days < 1) {
      toast.error('Enter valid days');
      return;
    }
    setUpdatingId(id);
    try {
      const res = await fetch('/api/admin/feed-banners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await withAuth()) },
        body: JSON.stringify({ id, extend_days: days }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Extend failed');
      toast.success(`Extended by ${days} days`);
      setExtendBannerId(null);
      loadBanners();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Extend failed');
    } finally {
      setUpdatingId(null);
    }
  };

  const openEdit = (b: Banner) => {
    setEditingBanner(b);
    setEditLinkUrl(b.link_url);
    setEditAlt(b.alt || '');
    setEditImageFile(null);
  };

  const handleEditSave = async () => {
    if (!editingBanner || !editLinkUrl.trim()) {
      toast.error('Link URL is required');
      return;
    }
    setSavingEdit(true);
    try {
      const auth = await withAuth();
      if (editImageFile) {
        const form = new FormData();
        form.set('id', editingBanner.id);
        form.set('link_url', editLinkUrl.trim());
        form.set('alt', editAlt.trim());
        form.set('image', editImageFile);
        const res = await fetch('/api/admin/feed-banners', {
          method: 'PATCH',
          headers: auth,
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Update failed');
        toast.success('Banner updated (including new image)');
      } else {
        const res = await fetch('/api/admin/feed-banners', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...auth },
          body: JSON.stringify({
            id: editingBanner.id,
            link_url: editLinkUrl.trim(),
            alt: editAlt.trim(),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Update failed');
        toast.success('Banner updated');
      }
      setEditingBanner(null);
      loadBanners();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this banner? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/feed-banners?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: await withAuth(),
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Delete failed');
      }
      toast.success('Banner deleted');
      loadBanners();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const statusTabs: { key: typeof statusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'on_hold', label: 'On hold' },
    { key: 'archived', label: 'Archived' },
  ];

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
          <ImagePlus className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Home FEED advertisement section</h1>
          <p className="text-sm text-slate-500">
            Add banners for the home feed. Set display duration (package or custom). Expired banners are automatically archived and hidden from the feed. Use Refresh or switch tabs to see updated status.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setAddBannerExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between gap-3 p-6 text-left hover:bg-slate-50 rounded-2xl transition"
        >
          <h2 className="text-sm font-semibold text-slate-800">Add banner</h2>
          {addBannerExpanded ? (
            <ChevronUp className="h-5 w-5 text-slate-500 shrink-0" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-500 shrink-0" />
          )}
        </button>
        {addBannerExpanded && (
        <div className="px-6 pb-6 pt-0">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Image</label>
            <div
              className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
                dragOver ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 bg-slate-50/50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f?.type.startsWith('image/')) setFile(f);
              }}
            >
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                id="banner-file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="banner-file" className="cursor-pointer">
                {file ? (
                  <div>
                    <img src={URL.createObjectURL(file)} alt="Preview" className="mx-auto max-h-32 rounded-lg object-contain" />
                    <p className="mt-2 text-sm text-slate-600">{file.name}</p>
                  </div>
                ) : (
                  <div className="text-slate-500">
                    <ImagePlus className="mx-auto h-10 w-10" />
                    <p className="mt-2 text-sm">Drop an image or click to choose</p>
                  </div>
                )}
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Link URL (required)</label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com or /marketplace"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
            <input
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Shown on the banner card in the list; also used as image alt text"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Display duration (package)</label>
              <select
                value={packageId}
                onChange={(e) => { setPackageId(e.target.value); setCustomDays(''); }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="">Select package</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.duration_days} days)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Or custom days</label>
              <input
                type="number"
                min={1}
                value={customDays}
                onChange={(e) => { setCustomDays(e.target.value); if (e.target.value) setPackageId(''); }}
                placeholder="e.g. 14, 30, 90"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={uploading || !file || !linkUrl.trim()}
            className="rounded-xl bg-amber-600 px-4 py-2.5 font-medium text-white hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload banner'}
          </button>
        </form>
        </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Banners</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadBanners()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
            {statusTabs.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                  statusFilter === key ? 'bg-white text-slate-900 shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
            </div>
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : banners.length === 0 ? (
          <p className="text-sm text-slate-500">No banners in this filter. Add one or change filter.</p>
        ) : (
          <ul className="space-y-4">
            {banners.map((b, index) => (
              <li key={b.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="shrink-0">
                    <a href={b.link_url} target="_blank" rel="noopener noreferrer" className="block w-40 h-24 rounded-lg overflow-hidden bg-white border border-slate-200">
                      <img src={b.image} alt={b.alt} className="w-full h-full object-cover" />
                    </a>
                    <a
                      href={`/api/admin/feed-banners/download?id=${encodeURIComponent(b.id)}`}
                      className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 w-40"
                    >
                      <Download className="h-3.5 w-3.5" /> Download image
                    </a>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">Banner {index + 1}</p>
                    {(b.alt || '').trim() ? (
                      <p className="text-sm text-slate-600 mt-0.5 line-clamp-2" title={b.alt}>{b.alt}</p>
                    ) : null}
                    <a href={b.link_url} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-600 hover:underline truncate block flex items-center gap-1 mt-1">
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{b.link_url}</span>
                    </a>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                        b.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        b.status === 'on_hold' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {b.status === 'active' ? 'Active' : b.status === 'on_hold' ? 'On hold' : 'Archived'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        {formatCountdown(b.expires_at)}
                      </span>
                      {b.duration_days && (
                        <span className="text-xs text-slate-500">{b.duration_days} days</span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-500 mt-3 mb-1.5">Actions</p>
                    <div className="flex flex-wrap gap-2">
                      {b.status === 'on_hold' && (
                        <button type="button" onClick={() => handleStatus(b.id, 'active')} disabled={updatingId === b.id} className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-200 disabled:opacity-50">
                          <CheckCircle className="h-3.5 w-3.5" /> Approve
                        </button>
                      )}
                      {b.status === 'active' && (
                        <button type="button" onClick={() => handleStatus(b.id, 'on_hold')} disabled={updatingId === b.id} className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-200 disabled:opacity-50">
                          <Pause className="h-3.5 w-3.5" /> On hold
                        </button>
                      )}
                      {b.status !== 'archived' && (
                        <button type="button" onClick={() => handleStatus(b.id, 'archived')} disabled={updatingId === b.id} className="inline-flex items-center gap-1 rounded-lg bg-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-300 disabled:opacity-50">
                          <Archive className="h-3.5 w-3.5" /> Archive
                        </button>
                      )}
                      <button type="button" onClick={() => openEdit(b)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button type="button" onClick={() => setExtendBannerId(extendBannerId === b.id ? null : b.id)} className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-200">
                        <CalendarPlus className="h-3.5 w-3.5" /> Extend
                      </button>
                      {extendBannerId === b.id && (
                        <span className="inline-flex items-center gap-1">
                          <input type="number" min={1} value={extendDays} onChange={(e) => setExtendDays(e.target.value)} className="w-16 rounded border border-slate-300 px-2 py-1 text-xs" />
                          <button type="button" onClick={() => handleExtend(b.id)} disabled={updatingId === b.id} className="text-xs font-medium text-blue-600 hover:underline">Apply</button>
                        </span>
                      )}
                      <button type="button" onClick={() => handleDelete(b.id)} disabled={deletingId === b.id} className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50" title="Permanently remove this banner">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = commentsExpandedId === b.id ? null : b.id;
                          setCommentsExpandedId(next);
                          if (next && commentsByBannerId[next] === undefined) loadComments(next);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Comments{(commentsByBannerId[b.id]?.length ?? 0) > 0 ? ` (${commentsByBannerId[b.id].length})` : ''}
                      </button>
                    </div>
                    {commentsExpandedId === b.id && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        {commentsLoadingId === b.id ? (
                          <p className="text-xs text-slate-500">Loading comments…</p>
                        ) : (
                          <>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {(commentsByBannerId[b.id] || []).map((c) => (
                                <div key={c.id} className="rounded-lg bg-white border border-slate-200 p-2.5 text-sm">
                                  <p className="text-slate-800">{c.body}</p>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {c.author || 'Admin'} · {new Date(c.created_at).toLocaleString()}
                                  </p>
                                </div>
                              ))}
                              {(commentsByBannerId[b.id]?.length ?? 0) === 0 && (
                                <p className="text-xs text-slate-500">No comments yet.</p>
                              )}
                            </div>
                            <div className="mt-3 flex gap-2">
                              <input
                                type="text"
                                value={newCommentByBannerId[b.id] ?? ''}
                                onChange={(e) => setNewCommentByBannerId((prev) => ({ ...prev, [b.id]: e.target.value }))}
                                placeholder="Add a comment…"
                                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                onKeyDown={(e) => { if (e.key === 'Enter') addComment(b.id); }}
                              />
                              <button
                                type="button"
                                onClick={() => addComment(b.id)}
                                disabled={postingCommentId === b.id || !(newCommentByBannerId[b.id] ?? '').trim()}
                                className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-600 disabled:opacity-50"
                              >
                                {postingCommentId === b.id ? 'Posting…' : 'Post'}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editingBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-banner-title">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 id="edit-banner-title" className="text-lg font-semibold text-slate-900">Edit banner</h2>
            <p className="mt-1 text-sm text-slate-500">Update link, description, or replace the photo.</p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Replace photo (optional)</label>
                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    id="edit-banner-image"
                    onChange={(e) => setEditImageFile(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="edit-banner-image" className="cursor-pointer block text-center">
                    {editImageFile ? (
                      <div>
                        <img src={URL.createObjectURL(editImageFile)} alt="New preview" className="mx-auto max-h-24 rounded-lg object-contain" />
                        <p className="mt-2 text-sm text-slate-600">{editImageFile.name}</p>
                        <p className="text-xs text-slate-500">New image will replace current banner photo on Save</p>
                      </div>
                    ) : (
                      <div className="text-slate-500 py-2">
                        <ImagePlus className="mx-auto h-8 w-8" />
                        <p className="mt-1 text-sm">Click or drop to upload a new image</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Link URL</label>
                <input
                  type="url"
                  value={editLinkUrl}
                  onChange={(e) => setEditLinkUrl(e.target.value)}
                  placeholder="https://example.com or /marketplace"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={editAlt}
                  onChange={(e) => setEditAlt(e.target.value)}
                  placeholder="Shown on the banner card"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingBanner(null)}
                disabled={savingEdit}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditSave}
                disabled={savingEdit || !editLinkUrl.trim()}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {savingEdit ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-4">
          <Package className="h-5 w-5 text-amber-600" />
          Display duration packages
        </h2>
        <p className="text-sm text-slate-500 mb-4">Predefined durations when adding a banner. Defaults: 2 weeks, 1 month, 3 months, 6 months, 1 year.</p>
        {packages.length === 0 ? (
          <p className="text-sm text-slate-500">No packages. Run the migration to seed defaults.</p>
        ) : (
          <ul className="space-y-2">
            {packages.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2">
                <span className="font-medium text-slate-800">{p.name}</span>
                <span className="text-sm text-slate-500">{p.duration_days} days</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
