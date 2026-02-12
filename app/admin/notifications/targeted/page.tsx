'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Search,
  UserPlus,
  X,
  Building2,
  Briefcase,
  User,
  Send,
  Trash2,
  Users,
  Mail,
  Phone,
  MessageSquare,
  Link2,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type SearchUser = {
  user_id: string;
  label: string;
  email: string | null;
  phone: string | null;
  type: 'organization' | 'business' | 'individual';
};

type HistoryItem = {
  campaignId: string;
  title: string;
  body: string;
  createdAt: string;
  count: number;
};

const TYPE_CONFIG = {
  organization: { label: 'Organization', icon: Building2, className: 'bg-violet-100 text-violet-700' },
  business: { label: 'Business', icon: Briefcase, className: 'bg-amber-100 text-amber-700' },
  individual: { label: 'Individual', icon: User, className: 'bg-emerald-100 text-emerald-700' },
} as const;

function UserChip({ u, onRemove }: { u: SearchUser; onRemove: () => void }) {
  const config = TYPE_CONFIG[u.type];
  const Icon = config.icon;
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-800">
      <Icon className="h-3.5 w-3.5 text-slate-500" />
      <span className="font-medium truncate max-w-[140px]">{u.label}</span>
      {(u.email || u.phone) && (
        <span className="text-slate-500 truncate max-w-[100px]">
          {u.email || u.phone}
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
        title="Remove"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function TypeBadge({ type }: { type: SearchUser['type'] }) {
  const config = TYPE_CONFIG[type];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

export default function AdminTargetedNotificationsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [receivers, setReceivers] = useState<SearchUser[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `/api/admin/users/search?q=${encodeURIComponent(trimmed)}`,
        { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSearchResults(data.users ?? []);
      else setSearchResults([]);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => runSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, runSearch]);

  const addToReceivers = (u: SearchUser) => {
    setReceivers((prev) => (prev.some((r) => r.user_id === u.user_id) ? prev : [...prev, u]));
  };
  const removeFromReceivers = (userId: string) => {
    setReceivers((prev) => prev.filter((r) => r.user_id !== userId));
  };

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/send-notifications?mode=direct', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setHistory(data.history || []);
      else setHistory([]);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const sendTargeted = async (e: React.FormEvent) => {
    e.preventDefault();
    if (receivers.length === 0 || !title.trim() || !body.trim()) {
      toast.error('Add at least one receiver and enter title and body');
      return;
    }
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/send-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          receiver_ids: receivers.map((r) => r.user_id),
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || null,
          mode: 'direct',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to send');
      toast.success(`Sent to ${data.sent ?? 0} recipient${(data.sent ?? 0) === 1 ? '' : 's'}`);
      setTitle('');
      setBody('');
      setUrl('');
      setReceivers([]);
      loadHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    if (!confirm('Remove this notification for all recipients?')) return;
    setDeletingId(campaignId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/send-notifications?campaignId=${encodeURIComponent(campaignId)}`, {
        method: 'DELETE',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to delete');
      }
      toast.success('Notification removed');
      setHistory((prev) => prev.filter((h) => h.campaignId !== campaignId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-5xl space-y-8">
      <Link
        href="/admin/notifications"
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Notifications
      </Link>

      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
          <Users className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Targeted notifications</h1>
          <p className="text-slate-600 mt-0.5">
            Search users by email, phone, or name. Add them as receivers and send a notification only to those people.
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr,1fr]">
        {/* Left: Search + Receivers */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3">
              <Search className="h-4 w-4 text-indigo-500" />
              Search users
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Type at least 2 characters to search by email, phone number, or name.
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. john@example.com, +1 555..., or John"
                className="w-full rounded-xl border border-slate-300 bg-slate-50/50 pl-10 pr-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
              />
              {searchLoading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin h-4 w-4 text-indigo-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </span>
              )}
            </div>

            {searchQuery.trim().length >= 2 && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 max-h-56 overflow-y-auto">
                {searchResults.length === 0 && !searchLoading ? (
                  <div className="p-6 text-center">
                    <User className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-2 text-sm text-slate-500">No users found for &quot;{searchQuery}&quot;</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-200">
                    {searchResults.map((u) => {
                      const added = receivers.some((r) => r.user_id === u.user_id);
                      return (
                        <li key={u.user_id} className="flex items-center justify-between gap-3 p-3 hover:bg-white/80 transition">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-900 truncate">{u.label}</p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                              {u.email && (
                                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                  <Mail className="h-3 w-3" />
                                  {u.email}
                                </span>
                              )}
                              {u.phone && (
                                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                  <Phone className="h-3 w-3" />
                                  {u.phone}
                                </span>
                              )}
                              {!u.email && !u.phone && <TypeBadge type={u.type} />}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <TypeBadge type={u.type} />
                            <button
                              type="button"
                              onClick={() => addToReceivers(u)}
                              disabled={added}
                              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition"
                            >
                              <UserPlus className="h-4 w-4" />
                              {added ? 'Added' : 'Add'}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3">
              <Users className="h-4 w-4 text-indigo-500" />
              Receivers
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {receivers.length}
              </span>
            </h2>
            {receivers.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                <Users className="mx-auto h-12 w-12 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">No receivers yet</p>
                <p className="text-xs text-slate-400 mt-0.5">Search above and click Add to include users.</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {receivers.map((r) => (
                  <UserChip key={r.user_id} u={r} onRemove={() => removeFromReceivers(r.user_id)} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: Compose + Send */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3">
              <MessageSquare className="h-4 w-4 text-indigo-500" />
              Compose notification
            </h2>
            <form onSubmit={sendTargeted} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title (max 140)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Notification title"
                  maxLength={140}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                />
                <p className="text-xs text-slate-500 mt-1">{title.length}/140</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Body (max 1000)</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your message..."
                  rows={5}
                  maxLength={1000}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-y transition"
                />
                <p className="text-xs text-slate-500 mt-1">{body.length}/1000</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <span className="inline-flex items-center gap-1"><Link2 className="h-3.5 w-3.5" /> Optional link URL</span>
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="/marketplace or https://..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                />
              </div>
              <button
                type="submit"
                disabled={sending || receivers.length === 0 || !title.trim() || !body.trim()}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition"
              >
                {sending ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Send to {receivers.length} receiver{receivers.length === 1 ? '' : 's'}
                  </>
                )}
              </button>
            </form>
          </section>
        </div>
      </div>

      {/* Previous notifications */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Previous notifications</h2>
        {historyLoading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-500">No notifications sent yet.</p>
        ) : (
          <ul className="space-y-3">
            {history.map((item) => (
              <li
                key={item.campaignId}
                className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 hover:bg-slate-50 transition"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-600 line-clamp-2 mt-0.5">{item.body}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    {item.count} recipient{item.count === 1 ? '' : 's'} · {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteCampaign(item.campaignId)}
                  disabled={deletingId === item.campaignId}
                  className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition"
                  title="Delete"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
