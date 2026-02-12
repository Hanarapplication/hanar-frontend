'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Send, ArrowLeft, Building2, Briefcase, User, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type TargetKey = 'organizations' | 'businesses' | 'individuals';

const TARGETS: { key: TargetKey; label: string; icon: React.ReactNode }[] = [
  { key: 'organizations', label: 'Organizations', icon: <Building2 className="h-4 w-4" /> },
  { key: 'businesses', label: 'Businesses', icon: <Briefcase className="h-4 w-4" /> },
  { key: 'individuals', label: 'Individuals', icon: <User className="h-4 w-4" /> },
];

type HistoryItem = {
  campaignId: string;
  title: string;
  body: string;
  createdAt: string;
  count: number;
};

export default function AdminRegularNotificationsPage() {
  const [targets, setTargets] = useState<Record<TargetKey, boolean>>({
    organizations: false,
    businesses: false,
    individuals: false,
  });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const toggleTarget = (key: TargetKey) => {
    setTargets((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const hasTarget = targets.organizations || targets.businesses || targets.individuals;

  const loadHistory = async () => {
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
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const sendDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasTarget || !title.trim() || !body.trim()) {
      toast.error('Select at least one target and enter title and body');
      return;
    }
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/send-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          targets,
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || null,
          mode: 'direct',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to send');
      toast.success(`Sent to ${data.sent ?? 0} recipients`);
      setTitle('');
      setBody('');
      setUrl('');
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
    <div className="max-w-3xl space-y-8">
      <Link
        href="/admin/notifications"
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Notifications
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
          <Send className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Regular notifications</h1>
          <p className="text-sm text-slate-500">Send to every selected recipient. No area limit.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Recipients</h2>
        <div className="flex flex-wrap gap-4 mb-6">
          {TARGETS.map(({ key, label, icon }) => (
            <label key={key} className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={targets[key]}
                onChange={() => toggleTarget(key)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="flex items-center gap-2 text-slate-700">{icon}{label}</span>
            </label>
          ))}
        </div>

        <h2 className="text-sm font-semibold text-slate-700 mb-2">Compose notification</h2>
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title (max 140)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notification title"
              maxLength={140}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <p className="text-xs text-slate-500 mt-0.5">{title.length}/140</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Body (max 1000)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Message content"
              rows={4}
              maxLength={1000}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y"
            />
            <p className="text-xs text-slate-500 mt-0.5">{body.length}/1000</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Optional link URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/marketplace or full URL"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={sendDirect}
          disabled={sending || !hasTarget || !title.trim() || !body.trim()}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {sending ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Sending...
            </>
          ) : (
            'Send to selected recipients'
          )}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Previous notifications</h2>
        {historyLoading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-500">No notifications sent yet.</p>
        ) : (
          <ul className="space-y-3">
            {history.map((item) => (
              <li
                key={item.campaignId}
                className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-600 line-clamp-2 mt-0.5">{item.body}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {item.count} recipients · {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteCampaign(item.campaignId)}
                  disabled={deletingId === item.campaignId}
                  className="shrink-0 rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  title="Delete"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
