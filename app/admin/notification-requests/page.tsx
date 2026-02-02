'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

type AreaBlastRequest = {
  id: string;
  kind: 'area_blast';
  title: string;
  body: string;
  created_at: string;
  business_id: string;
  status: 'pending' | 'approved' | 'sent' | 'rejected';
  radius_miles?: number | null;
  data?: {
    business_id?: string;
    business_name?: string;
    radius_miles?: number;
    sent_count?: number;
  };
};

const allowedRoles = ['owner', 'ceo', 'topmanager', 'manager', 'reviewer'];

export default function NotificationRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<AreaBlastRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editRadius, setEditRadius] = useState(3);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/area-blasts');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load requests');
      setRequests(data.requests || []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (
    id: string,
    action: 'approve' | 'reject' | 'delete' | 'update'
  ) => {
    try {
      const res = await fetch('/api/admin/area-blasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action,
          ...(action === 'update'
            ? { title: editTitle, body: editBody, radiusMiles: editRadius }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to process request');
      if (action === 'approve') {
        const extra =
          typeof data.locationCandidates === 'number'
            ? ` (matched ${data.matched || 0} of ${data.locationCandidates})`
            : '';
        toast.success(`Approved and sent to ${data.sent || 0} users${extra}`);
      } else if (action === 'reject') {
        toast.success('Request rejected');
      } else if (action === 'delete') {
        toast.success('Request deleted');
      } else {
        toast.success('Request updated');
        setEditingId(null);
      }
      loadRequests();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to process request');
    }
  };

  useEffect(() => {
    const role = Cookies.get('adminRole');
    if (!role || !allowedRoles.includes(role)) {
      router.push('/unauthorized');
      return;
    }
    loadRequests();
  }, [router]);

  const filtered = requests.filter((req) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      (req.title || '').toLowerCase().includes(term) ||
      (req.body || '').toLowerCase().includes(term) ||
      (req.data?.business_name || '').toLowerCase().includes(term)
    );
  });

  const pendingCount = requests.filter((req) => req.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <button onClick={() => router.push('/admin/owner')} className="mb-4 text-blue-600 underline">
          ← Back to Owner Dashboard
        </button>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-100/70">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Admin Review
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
                🔔 Review Business Notification Requests
              </h1>
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {pendingCount} pending
            </div>
          </div>
          <div className="mt-4">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by business, title, or message..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {loading ? (
            <div className="mt-6 text-sm text-slate-500">Loading requests...</div>
          ) : filtered.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center text-sm text-slate-600">
              No requests match your search.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {filtered.map((req) => {
                const status =
                  req.status === 'pending'
                    ? { label: 'Pending', color: 'bg-amber-100 text-amber-700' }
                    : req.status === 'approved'
                    ? { label: 'Approved', color: 'bg-blue-100 text-blue-700' }
                    : req.status === 'rejected'
                    ? { label: 'Rejected', color: 'bg-rose-100 text-rose-700' }
                    : { label: 'Sent', color: 'bg-emerald-100 text-emerald-700' };
                const isEditable = req.status === 'pending';
                const isEditing = editingId === req.id;

                return (
                  <div key={req.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{req.title}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-indigo-500">
                        {req.data?.business_name || 'Business'}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">{req.body}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1">
                          Radius: {req.radius_miles || req.data?.radius_miles || 3} miles
                        </span>
                        {typeof req.data?.sent_count === 'number' && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">
                            Sent: {req.data.sent_count}
                          </span>
                        )}
                        <span className="rounded-full bg-slate-100 px-2.5 py-1">
                          {new Date(req.created_at).toLocaleString()}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 font-semibold ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isEditable && (
                        <>
                          <button
                            onClick={() => handleAction(req.id, 'approve')}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(req.id, 'reject')}
                            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(req.id);
                              setEditTitle(req.title);
                              setEditBody(req.body);
                              setEditRadius(req.radius_miles || req.data?.radius_miles || 3);
                            }}
                            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                          >
                            Edit
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleAction(req.id, 'delete')}
                        className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-3">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Title
                          </label>
                          <input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Message
                          </label>
                          <textarea
                            value={editBody}
                            onChange={(e) => setEditBody(e.target.value)}
                            rows={3}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Radius (miles)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={editRadius}
                            onChange={(e) => setEditRadius(Number(e.target.value))}
                            className="mt-1 w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAction(req.id, 'update')}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
