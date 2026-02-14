'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Radio, ArrowLeft, Building2, Briefcase, User, MessageSquare, Smartphone, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAdminConfirm } from '@/components/AdminConfirmContext';

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

export default function AdminBlastNotificationsPage() {
  const [targets, setTargets] = useState<Record<TargetKey, boolean>>({
    organizations: false,
    businesses: false,
    individuals: false,
  });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [blastDelivery, setBlastDelivery] = useState<'in_app' | 'push' | 'both'>('in_app');
  const [blastUnlimited, setBlastUnlimited] = useState(true);
  const [blastRadiusMiles, setBlastRadiusMiles] = useState<number>(50);
  const [blastAddress, setBlastAddress] = useState('');
  const [blastLat, setBlastLat] = useState('');
  const [blastLon, setBlastLon] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { showConfirm } = useAdminConfirm();

  const toggleTarget = (key: TargetKey) => {
    setTargets((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const hasTarget = targets.organizations || targets.businesses || targets.individuals;

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/send-notifications?mode=blast', {
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

  const sendBlast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasTarget || !title.trim() || !body.trim()) {
      toast.error('Select at least one target and enter title and body');
      return;
    }
    if (!blastUnlimited) {
      const radius = Number(blastRadiusMiles);
      if (!radius || radius <= 0) {
        toast.error('Enter a positive radius in miles');
        return;
      }
      if (!blastAddress.trim() && (blastLat === '' || blastLon === '')) {
        toast.error('Enter a center address or lat/lon for radius blast');
        return;
      }
    }
    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        targets,
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || null,
        mode: 'blast',
        blastDelivery,
        unlimitedRadius: blastUnlimited,
      };
      if (!blastUnlimited) {
        payload.radiusMiles = Number(blastRadiusMiles) || 50;
        if (blastAddress.trim()) payload.address = blastAddress.trim();
        else if (blastLat !== '' && blastLon !== '') {
          payload.lat = Number(blastLat);
          payload.lon = Number(blastLon);
        }
      }
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/send-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to send blast');
      const inApp = data.inAppSent ?? 0;
      const push = data.pushSent ?? 0;
      if (blastDelivery === 'both' && (inApp > 0 || push > 0)) {
        toast.success(`Blast sent: ${inApp} in-app, ${push} push`);
      } else {
        toast.success(`Blast sent to ${data.sent ?? 0} recipients`);
      }
      setTitle('');
      setBody('');
      setUrl('');
      loadHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send blast');
    } finally {
      setSending(false);
    }
  };

  const deleteCampaign = (campaignId: string) => {
    showConfirm({
      title: 'Remove blast?',
      message: 'Remove this blast for all recipients?',
      confirmLabel: 'Remove',
      variant: 'danger',
      onConfirm: async () => {
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
          toast.success('Blast removed');
          setHistory((prev) => prev.filter((h) => h.campaignId !== campaignId));
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to delete');
        } finally {
          setDeletingId(null);
        }
      },
    });
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
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Radio className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Blast notifications</h1>
          <p className="text-sm text-slate-500">Target by radius, in-app and/or push. Unlimited or custom mile radius.</p>
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

        <h2 className="text-sm font-semibold text-slate-700 mb-2">Write notification</h2>
        <div className="space-y-4 mb-6 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
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

        <h2 className="text-sm font-semibold text-slate-700 mb-2">Delivery</h2>
        <div className="flex flex-wrap gap-4 mb-4">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="radio" name="blastDelivery" checked={blastDelivery === 'in_app'} onChange={() => setBlastDelivery('in_app')} className="border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <MessageSquare className="h-4 w-4 text-slate-500" />
            <span className="text-slate-700">In-app only</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="radio" name="blastDelivery" checked={blastDelivery === 'push'} onChange={() => setBlastDelivery('push')} className="border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <Smartphone className="h-4 w-4 text-slate-500" />
            <span className="text-slate-700">Push only</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="radio" name="blastDelivery" checked={blastDelivery === 'both'} onChange={() => setBlastDelivery('both')} className="border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-slate-700">Both</span>
          </label>
        </div>

        <h2 className="text-sm font-semibold text-slate-700 mb-2">Area limit</h2>
        <div className="flex flex-wrap gap-4 mb-4">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="radio" name="blastArea" checked={blastUnlimited} onChange={() => setBlastUnlimited(true)} className="border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-slate-700">Unlimited</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="radio" name="blastArea" checked={!blastUnlimited} onChange={() => setBlastUnlimited(false)} className="border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-slate-700">Custom radius</span>
          </label>
        </div>
        {!blastUnlimited && (
          <div className="pl-4 border-l-2 border-slate-200 space-y-3 mb-6">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700 w-24">Radius (mi)</label>
              <input type="number" min={1} max={9999} value={blastRadiusMiles} onChange={(e) => setBlastRadiusMiles(Number(e.target.value) || 0)} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Center: address</label>
              <input type="text" value={blastAddress} onChange={(e) => setBlastAddress(e.target.value)} placeholder="City, state or full address" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
            <div className="flex gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Latitude</label>
                <input type="text" value={blastLat} onChange={(e) => setBlastLat(e.target.value)} placeholder="e.g. 40.7128" className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Longitude</label>
                <input type="text" value={blastLon} onChange={(e) => setBlastLon(e.target.value)} placeholder="e.g. -74.0060" className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={sendBlast}
          disabled={sending || !hasTarget || !title.trim() || !body.trim()}
          className="rounded-xl bg-slate-800 px-4 py-2.5 font-medium text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {sending ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Sending blast...
            </>
          ) : (
            'Send blast'
          )}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Previous blasts</h2>
        {historyLoading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-500">No blasts sent yet.</p>
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
