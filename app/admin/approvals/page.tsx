'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

// ──────────────────────────────────────────────── Types
type BusinessStatus = 'pending' | 'approved' | 'hold' | 'archived' | 'rejected';
type BusinessVisibilityStatus = 'active' | 'inactive';

type PlanName = 'free' | 'starter' | 'growth' | 'premium';

interface VerifiedInfo {
  infoCorrect: boolean;
  addressCorrect: boolean;
  phoneCorrect: boolean;
  paymentCorrect: boolean;
}

interface NoteEntry {
  note: string;
  timestamp: string;
}

interface Business {
  id: string;
  business_name: string;
  slug: string;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;

  business_status: BusinessStatus;
  status: BusinessVisibilityStatus;

  verified_info?: Partial<VerifiedInfo> | null;
  admin_note?: string | null;
  note_history?: NoteEntry[] | null;
  updated_at?: string | null;

  // Plan fields (from businesses table)
  plan?: PlanName | null;
  plan_expires_at?: string | null;

  max_gallery_images?: number | null;
  max_menu_items?: number | null;
  max_retail_items?: number | null;
  max_car_listings?: number | null;

  allow_social_links?: boolean | null;
  allow_whatsapp?: boolean | null;
  allow_promoted?: boolean | null;
  allow_reviews?: boolean | null;
  allow_qr?: boolean | null;
}

type SentNotification = {
  id: string;
  kind: 'follower_update' | 'area_blast';
  title: string;
  body: string;
  created_at: string;
  status?: 'pending' | 'approved' | 'sent' | 'rejected';
  data?: {
    business_id?: string;
    business_name?: string;
    radius_miles?: number;
    sent_count?: number;
    flagged?: boolean;
    flagged_at?: string | null;
  };
};

const PLAN_LABELS: Record<PlanName, string> = {
  free: 'Free ($0/yr)',
  starter: 'Starter ($99/yr)',
  growth: 'Growth ($299/yr)',
  premium: 'Premium ($399/yr)',
};

// ──────────────────────────────────────────────── Main Page
export default function AdminApprovalsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | BusinessStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchBusinesses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchBusinesses() {
    setLoading(true);

    const { data, error } = await supabase
      .from('businesses')
      .select(
        `
        id, business_name, slug, phone, email, whatsapp,
        business_status, status, verified_info,
        admin_note, note_history, updated_at,
        plan, plan_expires_at,
        max_gallery_images, max_menu_items, max_retail_items, max_car_listings,
        allow_social_links, allow_whatsapp, allow_promoted, allow_reviews, allow_qr
      `
      )
      .order('updated_at', { ascending: false, nullsFirst: true });

    if (error) {
      console.error('Fetch failed:', error);
      toast.error(`Failed to load businesses: ${error.message}`);
      setBusinesses([]);
      setLoading(false);
      return;
    }

    setBusinesses((data as Business[]) || []);
    setLoading(false);
  }

  // ✅ Notes logic preserved (same behavior): note saved only on action; note_history appended
  async function saveBusinessUpdates(id: string, updates: Partial<Business>, noteToSave?: string) {
    let finalUpdates: Partial<Business> = { ...updates };

    if (noteToSave !== undefined && noteToSave.trim() !== '') {
      finalUpdates.admin_note = noteToSave.trim();

      const { data: current, error: currentErr } = await supabase
        .from('businesses')
        .select('note_history')
        .eq('id', id)
        .single();

      if (currentErr) {
        console.error('Failed to fetch note_history:', currentErr);
        toast.error(`Save failed: ${currentErr.message}`);
        return false;
      }

      const currentHistory = (current?.note_history as NoteEntry[] | null) ?? [];
      const newEntry: NoteEntry = { note: noteToSave.trim(), timestamp: new Date().toISOString() };
      finalUpdates.note_history = [...currentHistory, newEntry];
    }

    if (Object.keys(finalUpdates).length === 0) return true;

    const { error } = await supabase
      .from('businesses')
      .update(finalUpdates)
      .eq('id', id)
      .select('id')
      .single();

    if (error) {
      console.error('Update error:', error);
      toast.error(`Save failed: ${error.message}`);
      return false;
    }

    return true;
  }

  async function deleteBusiness(id: string) {
    const { error } = await supabase.from('businesses').delete().eq('id', id);
    if (error) {
      console.error('Delete failed:', error);
      toast.error(`Delete failed: ${error.message}`);
      return;
    }

    toast.success('Business deleted');
    fetchBusinesses();
  }

  // ✅ Apply plan using your SQL function (created in Supabase)
  async function applyPlan(businessId: string, plan: PlanName, years: number) {
    const { error } = await supabase.rpc('apply_business_plan', {
      p_business_id: businessId,
      p_plan: plan,
      p_years: years,
    });

    if (error) {
      console.error('Apply plan failed:', error);
      toast.error(`Apply plan failed: ${error.message}`);
      return false;
    }

    toast.success('Plan applied');
    return true;
  }

  const filteredBusinesses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return businesses.filter((b) => {
      const matchStatus = filterStatus === 'all' || b.business_status === filterStatus;
      const matchSearch = term === '' || (b.business_name || '').toLowerCase().includes(term);
      return matchStatus && matchSearch;
    });
  }, [businesses, filterStatus, searchTerm]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto min-h-screen bg-gray-50">
      <button onClick={() => router.push('/admin/owner')} className="mb-4 text-blue-600 underline">
        ← Back to Owner Dashboard
      </button>

      <h1 className="text-3xl font-bold mb-6">Admin Panel — Manage Businesses</h1>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Search businesses..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border rounded-lg px-4 py-2 flex-1"
        />
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'approved', 'hold', 'archived'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg ${
                filterStatus === status ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filteredBusinesses.length === 0 ? (
        <div>No businesses match your criteria.</div>
      ) : (
        <div className="space-y-5">
          {filteredBusinesses.map((biz) => (
            <BusinessCard
              key={biz.id}
              biz={biz}
              saveUpdates={async (upd, note) => {
                const ok = await saveBusinessUpdates(biz.id, upd, note);
                if (ok) await fetchBusinesses();
                return ok;
              }}
              deleteBusiness={deleteBusiness}
              applyPlan={async (plan, years) => {
                const ok = await applyPlan(biz.id, plan, years);
                if (ok) await fetchBusinesses();
                return ok;
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────── Business Card
function BusinessCard({
  biz,
  saveUpdates,
  deleteBusiness,
  applyPlan,
}: {
  biz: Business;
  saveUpdates: (updates: Partial<Business>, note?: string) => Promise<boolean>;
  deleteBusiness: (id: string) => Promise<void>;
  applyPlan: (plan: PlanName, years: number) => Promise<boolean>;
}) {
  const [verified, setVerified] = useState<VerifiedInfo>({
    infoCorrect: !!biz.verified_info?.infoCorrect,
    addressCorrect: !!biz.verified_info?.addressCorrect,
    phoneCorrect: !!biz.verified_info?.phoneCorrect,
    paymentCorrect: !!biz.verified_info?.paymentCorrect,
  });

  const [adminNote, setAdminNote] = useState(biz.admin_note || '');
  const [showHistory, setShowHistory] = useState(false);
  const [sentNotifications, setSentNotifications] = useState<SentNotification[]>([]);
  const [sentLoading, setSentLoading] = useState(false);
  const [sentLoaded, setSentLoaded] = useState(false);
  const [editingSentId, setEditingSentId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');

  const [selectedPlan, setSelectedPlan] = useState<PlanName>((biz.plan as PlanName) || 'free');
  const [planYears, setPlanYears] = useState<number>(1);
  const [planLoading, setPlanLoading] = useState(false);

  useEffect(() => {
    setVerified({
      infoCorrect: !!biz.verified_info?.infoCorrect,
      addressCorrect: !!biz.verified_info?.addressCorrect,
      phoneCorrect: !!biz.verified_info?.phoneCorrect,
      paymentCorrect: !!biz.verified_info?.paymentCorrect,
    });
    setAdminNote(biz.admin_note || '');
    setSelectedPlan((biz.plan as PlanName) || 'free');
    setSentNotifications([]);
    setSentLoaded(false);
    setEditingSentId(null);
    setEditTitle('');
    setEditBody('');
  }, [biz.id, biz.verified_info, biz.admin_note, biz.plan]);

  const canApprove = Object.values(verified).every(Boolean);

  const confirmAndSave = async (
    action: string,
    newStatus: BusinessStatus,
    visibility: BusinessVisibilityStatus
  ) => {
    const noteText = adminNote.trim();
    const hasNote = noteText.length > 0;

    const message = hasNote
      ? `Save note and ${action.toLowerCase()} this business?\n\nNote to be saved:\n${noteText}`
      : `Really ${action.toLowerCase()} this business?\n(No note will be saved)`;

    if (!confirm(message)) return;

    const success = await saveUpdates(
      {
        business_status: newStatus,
        status: visibility,
        verified_info: verified,
      },
      hasNote ? noteText : undefined
    );

    if (success) toast.success(`${action} successful`);
  };

  const confirmAndDelete = async () => {
    if (!confirm(`Really delete ${biz.business_name} permanently?\nThis cannot be undone.`)) return;
    await deleteBusiness(biz.id);
  };

  const confirmAndApplyPlan = async () => {
    const message = `Apply plan "${selectedPlan}" for ${planYears} year(s) to:\n\n${biz.business_name}\n\nThis will update plan limits & expiration. Continue?`;
    if (!confirm(message)) return;

    setPlanLoading(true);
    const appliedOk = await applyPlan(selectedPlan, planYears);
    setPlanLoading(false);

    if (appliedOk) toast.success('Plan applied');
  };

  const loadSentNotifications = async () => {
    setSentLoading(true);
    try {
      const res = await fetch(`/api/admin/notifications?businessId=${encodeURIComponent(biz.id)}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to load sent notifications');
      setSentNotifications((payload.notifications as SentNotification[]) || []);
      setSentLoaded(true);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load sent notifications');
    } finally {
      setSentLoading(false);
    }
  };

  const startEditSent = (item: SentNotification) => {
    setEditingSentId(item.id);
    setEditTitle(item.title);
    setEditBody(item.body);
  };

  const saveSentEdit = async (id: string) => {
    const nextTitle = editTitle.trim();
    const nextBody = editBody.trim();
    if (!nextTitle || !nextBody) {
      toast.error('Title and body are required');
      return;
    }
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'update', title: nextTitle, body: nextBody }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to update notification');
      setSentNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, title: nextTitle, body: nextBody } : n))
      );
      setEditingSentId(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update notification');
    }
  };

  const removeSent = async (id: string) => {
    if (!confirm('Remove this sent notification log?')) return;
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'delete' }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to remove notification');
      setSentNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove notification');
    }
  };

  const toggleFlagSent = async (item: SentNotification) => {
    const flagged = Boolean(item.data?.flagged);
    const nextFlag = !flagged;
    const nextData = {
      ...(item.data || {}),
      flagged: nextFlag,
      flagged_at: nextFlag ? new Date().toISOString() : null,
    };
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, action: 'flag', flagged: nextFlag }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to flag notification');
      setSentNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, data: nextData } : n))
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to flag notification');
    }
  };

  const historyCount = biz.note_history?.length || 0;

  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-5 text-sm border border-gray-200">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold">{biz.business_name}</h2>
          {biz.phone && <p className="text-gray-600">📞 {biz.phone}</p>}
          {biz.email && <p className="text-gray-600">✉️ {biz.email}</p>}

          <p className="text-xs text-gray-500 mt-1">
            Visibility: <span className="font-medium">{biz.status}</span>
          </p>

          <p className="text-xs text-gray-500 mt-1">
            Plan:{' '}
            <span className="font-medium">
              {(biz.plan as PlanName) || 'free'}
            </span>
            {' · '}
            Expires:{' '}
            <span className="font-medium">
              {biz.plan_expires_at ? new Date(biz.plan_expires_at).toLocaleDateString() : '—'}
            </span>
          </p>

          <p className="text-xs text-gray-500 mt-1">
            Limits:{' '}
            <span className="font-medium">
              Gallery {biz.max_gallery_images ?? 0} · Menu {biz.max_menu_items ?? 0} · Retail{' '}
              {biz.max_retail_items ?? 0} · Cars {biz.max_car_listings ?? 0}
            </span>
          </p>
        </div>

        <div className="text-right">
          <StatusBadge status={biz.business_status} />
          <button
            onClick={() => window.open(`/business/${biz.slug}`, '_blank')}
            className="mt-2 inline-flex items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 shadow-sm transition hover:bg-blue-100"
          >
            View Page
          </button>
          <button
            onClick={() => window.open(`/businesses/edit/${biz.slug}`, '_blank')}
            className="mt-2 inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 shadow-sm transition hover:bg-emerald-100"
          >
            Edit Business
          </button>
        </div>
      </div>

      {/* PLAN CONTROL */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="font-semibold text-gray-800">Plan Control</div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value as PlanName)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="free">{PLAN_LABELS.free}</option>
              <option value="starter">{PLAN_LABELS.starter}</option>
              <option value="growth">{PLAN_LABELS.growth}</option>
              <option value="premium">{PLAN_LABELS.premium}</option>
            </select>

            <select
              value={planYears}
              onChange={(e) => setPlanYears(parseInt(e.target.value, 10))}
              className="border rounded-lg px-3 py-2 text-sm"
              title="Duration"
            >
              <option value={1}>1 year</option>
              <option value={2}>2 years</option>
              <option value={3}>3 years</option>
            </select>

            <button
              onClick={confirmAndApplyPlan}
              disabled={planLoading}
              className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${
                planLoading ? 'bg-purple-300 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {planLoading ? 'Applying…' : 'Apply Plan'}
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-600">
          Features:{' '}
          <span className="font-medium">
            Social {biz.allow_social_links ? 'Yes' : 'No'} · WhatsApp {biz.allow_whatsapp ? 'Yes' : 'No'} · Promoted{' '}
            {biz.allow_promoted ? 'Yes' : 'No'} · Reviews {biz.allow_reviews ? 'Yes' : 'No'} · QR{' '}
            {biz.allow_qr ? 'Yes' : 'No'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Checkbox
          label="Info Correct"
          checked={verified.infoCorrect}
          onChange={(v) => setVerified((p) => ({ ...p, infoCorrect: v }))}
        />
        <Checkbox
          label="Address Correct"
          checked={verified.addressCorrect}
          onChange={(v) => setVerified((p) => ({ ...p, addressCorrect: v }))}
        />
        <Checkbox
          label="Phone Correct"
          checked={verified.phoneCorrect}
          onChange={(v) => setVerified((p) => ({ ...p, phoneCorrect: v }))}
        />
        <Checkbox
          label="Payment Done"
          checked={verified.paymentCorrect}
          onChange={(v) => setVerified((p) => ({ ...p, paymentCorrect: v }))}
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-sm font-medium text-gray-700">
            Admin Notes (saved automatically on action)
          </label>
          <button
            onClick={() => setShowHistory(true)}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            View history ({historyCount})
          </button>
        </div>

        <textarea
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
          placeholder="Write notes here — they will be saved automatically when you take an action"
        />
      </div>

      <div className="flex flex-wrap gap-2.5 pt-2">
        <button
          onClick={() => confirmAndSave('Approve', 'approved', 'active')}
          disabled={!canApprove}
          className={`px-5 py-2 rounded-lg text-white font-medium ${
            canApprove ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          Approve
        </button>

        <button
          onClick={() => confirmAndSave('Reject', 'rejected', 'inactive')}
          className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
        >
          Reject
        </button>

        <button
          onClick={() => confirmAndSave('Hold', 'hold', 'inactive')}
          className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium"
        >
          Hold
        </button>

        <button
          onClick={() => confirmAndSave('Archive', 'archived', 'inactive')}
          className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
        >
          Archive
        </button>

        <button
          onClick={confirmAndDelete}
          className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium ml-auto"
        >
          Delete
        </button>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Sent Notifications</p>
            <p className="text-xs text-gray-500">
              {sentLoaded ? `${sentNotifications.length} total` : 'Load to view'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadSentNotifications}
              disabled={sentLoading}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${
                sentLoading ? 'bg-gray-200 text-gray-500' : 'bg-white text-gray-700'
              }`}
            >
              {sentLoading ? 'Loading…' : sentLoaded ? 'Refresh' : 'Load'}
            </button>
          </div>
        </div>

        {sentLoaded && (
          <div className="mt-3 space-y-3">
            {sentNotifications.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 p-3 text-xs text-gray-500">
                No sent notifications yet.
              </div>
            ) : (
              sentNotifications.map((item) => {
                const isEditing = editingSentId === item.id;
                const kind = item.kind === 'area_blast' ? 'Area Blast' : 'Notification';
                const flagged = Boolean(item.data?.flagged);
                const statusLabel =
                  item.status === 'pending'
                    ? 'Pending'
                    : item.status === 'approved'
                    ? 'Approved'
                    : item.status === 'rejected'
                    ? 'Rejected'
                    : item.status === 'sent'
                    ? 'Sent'
                    : null;
                return (
                  <div key={item.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{kind}</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">{item.title}</p>
                        <p className="mt-1 text-xs text-gray-600">{item.body}</p>
                      </div>
                      <div className="text-right text-xs text-gray-500 space-y-1">
                        <div>{new Date(item.created_at).toLocaleString()}</div>
                        {flagged && (
                          <div className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Flagged
                          </div>
                        )}
                        {statusLabel && (
                          <div className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {statusLabel}
                          </div>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-3 space-y-2">
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          placeholder="Title"
                        />
                        <textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={3}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          placeholder="Body"
                        />
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {typeof item.data?.radius_miles === 'number' && (
                        <span className="rounded-full bg-white px-2 py-1 text-gray-600 border border-gray-200">
                          Radius: {item.data.radius_miles} miles
                        </span>
                      )}
                      {typeof item.data?.sent_count === 'number' && (
                        <span className="rounded-full bg-white px-2 py-1 text-gray-600 border border-gray-200">
                          Sent: {item.data.sent_count}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveSentEdit(item.id)}
                            className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingSentId(null)}
                            className="px-3 py-1.5 rounded-md bg-gray-200 text-gray-700 text-xs font-semibold"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditSent(item)}
                            className="px-3 py-1.5 rounded-md bg-white border border-gray-300 text-gray-700 text-xs font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleFlagSent(item)}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                              flagged
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-white border border-gray-300 text-gray-700'
                            }`}
                          >
                            {flagged ? 'Unflag' : 'Flag'}
                          </button>
                          <button
                            onClick={() => removeSent(item.id)}
                            className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-semibold"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Note History Modal */}
      {showHistory && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b flex justify-between items-center">
              <h3 className="text-xl font-semibold">{biz.business_name} — Note History</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-600 hover:text-gray-900 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {biz.note_history && biz.note_history.length > 0 ? (
                biz.note_history
                  .slice()
                  .reverse()
                  .map((entry, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${
                        index === 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <p className="text-gray-800 whitespace-pre-wrap">{entry.note || '(empty note)'}</p>
                      <p className="mt-2 text-xs text-gray-500">
                        {new Date(entry.timestamp).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    </div>
                  ))
              ) : (
                <div className="text-center py-12 text-gray-500 italic">No notes have been saved yet.</div>
              )}
            </div>

            <div className="p-5 border-t flex justify-end">
              <button
                onClick={() => setShowHistory(false)}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center space-x-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 text-blue-600 rounded border-gray-300"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    approved: 'bg-green-600',
    pending: 'bg-yellow-500',
    hold: 'bg-orange-600',
    archived: 'bg-gray-500',
    rejected: 'bg-red-600',
    unknown: 'bg-gray-300',
  };
  const safe = (status || 'unknown').toLowerCase();
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs text-white ${colors[safe] || colors.unknown}`}>
      {safe}
    </span>
  );
}
