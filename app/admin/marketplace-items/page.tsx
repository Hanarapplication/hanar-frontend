'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Pencil, Trash2, PauseCircle, PlayCircle, CheckCircle2, XCircle, Mail, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { MarketplaceCategorySelects } from '@/components/MarketplaceCategorySelects';

type AdminNote = {
  id: string;
  body: string;
  created_at: string;
  admin_user_id: string | null;
  admin_email: string | null;
};

type AdminMarketplaceItem = {
  id: string;
  user_id: string;
  username: string | null;
  title: string;
  price: string | number;
  location: string | null;
  category: string | null;
  condition: string | null;
  description: string | null;
  external_buy_url: string | null;
  image_urls: string[] | null;
  created_at: string | null;
  expires_at: string | null;
  is_on_hold: boolean;
  is_reviewed: boolean | null;
  is_expired: boolean;
  archived_at: string | null;
  archive_source: string | null;
};

type EditableFields = Pick<
  AdminMarketplaceItem,
  'title' | 'price' | 'location' | 'category' | 'condition' | 'description' | 'external_buy_url'
> & { expires_at: string | null };

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'expired', label: 'Expired' },
  { value: 'reviewed', label: 'Approved' },
  { value: 'unreviewed', label: 'Pending approval' },
] as const;

function toDateTimeInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function AdminMarketplaceItemsPage() {
  const [items, setItems] = useState<AdminMarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('all');
  const [error, setError] = useState<string | null>(null);

  const [editingItem, setEditingItem] = useState<AdminMarketplaceItem | null>(null);
  const [editForm, setEditForm] = useState<EditableFields | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [notesByItem, setNotesByItem] = useState<Record<string, AdminNote[]>>({});
  const [notesLoading, setNotesLoading] = useState<Record<string, boolean>>({});
  const [noteDraftByItem, setNoteDraftByItem] = useState<Record<string, string>>({});
  const [noteSavingId, setNoteSavingId] = useState<string | null>(null);

  const [emailItem, setEmailItem] = useState<AdminMarketplaceItem | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const params = new URLSearchParams({
        q: search,
        status,
        archive: archiveFilter,
        limit: '150',
      });
      const res = await fetch(`/api/admin/marketplace-items?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load items');
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [search, status, archiveFilter]);

  const openEditModal = (item: AdminMarketplaceItem) => {
    setEditingItem(item);
    setEditForm({
      title: item.title || '',
      price: item.price,
      location: item.location || '',
      category: item.category || '',
      condition: item.condition || '',
      description: item.description || '',
      external_buy_url: item.external_buy_url || '',
      expires_at: item.expires_at,
    });
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setEditForm(null);
  };

  const openEmailModal = (item: AdminMarketplaceItem) => {
    setEmailItem(item);
    setEmailSubject(`Your Hanar marketplace listing: ${item.title || 'Listing'}`);
    setEmailMessage('');
  };

  const closeEmailModal = () => {
    setEmailItem(null);
    setEmailSubject('');
    setEmailMessage('');
    setEmailSending(false);
  };

  const sendSellerEmail = async () => {
    if (!emailItem) return;
    const subject = emailSubject.trim();
    const message = emailMessage.trim();
    if (!subject || !message) {
      toast.error('Subject and message are required');
      return;
    }
    setEmailSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/admin/marketplace-items/${encodeURIComponent(emailItem.id)}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ subject, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to send email');
      toast.success('Email sent from support@hanar.net');
      closeEmailModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email');
      setEmailSending(false);
    }
  };

  const authHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadNotesForItem = async (itemId: string) => {
    setNotesLoading((p) => ({ ...p, [itemId]: true }));
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/admin/marketplace-items/${encodeURIComponent(itemId)}/notes`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load notes');
      setNotesByItem((prev) => ({ ...prev, [itemId]: data.notes || [] }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load notes');
    } finally {
      setNotesLoading((p) => ({ ...p, [itemId]: false }));
    }
  };

  const toggleRowExpanded = (itemId: string) => {
    setExpanded((prev) => {
      const nextOpen = !prev[itemId];
      if (nextOpen) {
        queueMicrotask(() => void loadNotesForItem(itemId));
      }
      return { ...prev, [itemId]: nextOpen };
    });
  };

  const saveNote = async (itemId: string) => {
    const body = (noteDraftByItem[itemId] || '').trim();
    if (!body) {
      toast.error('Enter a note first');
      return;
    }
    setNoteSavingId(itemId);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/admin/marketplace-items/${encodeURIComponent(itemId)}/notes`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save note');
      const note = data.note as AdminNote;
      setNotesByItem((prev) => ({
        ...prev,
        [itemId]: [...(prev[itemId] || []), note],
      }));
      setNoteDraftByItem((prev) => ({ ...prev, [itemId]: '' }));
      toast.success('Note added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save note');
    } finally {
      setNoteSavingId(null);
    }
  };

  const deleteNote = async (itemId: string, noteId: string) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      const headers = await authHeaders();
      const res = await fetch(
        `/api/admin/marketplace-items/${encodeURIComponent(itemId)}/notes/${encodeURIComponent(noteId)}`,
        { method: 'DELETE', headers }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Delete failed');
      setNotesByItem((prev) => ({
        ...prev,
        [itemId]: (prev[itemId] || []).filter((n) => n.id !== noteId),
      }));
      toast.success('Note deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const updateItemInState = (updated: AdminMarketplaceItem) => {
    setItems((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
  };

  const runItemAction = async (
    itemId: string,
    payload: Record<string, unknown>,
    successMessage: string
  ) => {
    setActionLoadingId(itemId);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/admin/marketplace-items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Action failed');
      updateItemInState(data.item as AdminMarketplaceItem);
      toast.success(successMessage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const deleteItem = async (itemId: string) => {
    const yes = window.confirm(
      'Archive this listing? It will leave the public marketplace, appear under Archives for admins, and the seller will receive a removal email.'
    );
    if (!yes) return;
    setActionLoadingId(itemId);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/admin/marketplace-items/${itemId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Archive failed');
      toast.success('Listing archived; seller was emailed');
      await loadItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Archive failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const saveEdit = async () => {
    if (!editingItem || !editForm) return;
    if (!(editForm.category || '').trim()) {
      setError('Select a category and subcategory before saving.');
      return;
    }
    setSavingEdit(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const expires_at = editForm.expires_at ? new Date(editForm.expires_at).toISOString() : null;
      const res = await fetch(`/api/admin/marketplace-items/${editingItem.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...editForm,
          expires_at,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Save failed');
      updateItemInState(data.item as AdminMarketplaceItem);
      closeEditModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingEdit(false);
    }
  };

  const resultsLabel = useMemo(
    () => `${items.length} ${items.length === 1 ? 'item' : 'items'}`,
    [items.length]
  );

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Marketplace Items</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search and moderate listings. Expand a row for <strong className="font-medium text-slate-700">admin notes</strong>{' '}
          (full history, deletable). Seller deletes archive the row here under Archives; admin archive emails the seller.
          Use <strong className="font-medium text-slate-700">Approve</strong>, <strong className="font-medium text-slate-700">Activate</strong>,{' '}
          <strong className="font-medium text-slate-700">Put on hold</strong>, and email from{' '}
          <span className="font-medium text-slate-700">support@hanar.net</span>.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title, category, location, description, username..."
              className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <select
            value={archiveFilter}
            onChange={(e) => setArchiveFilter(e.target.value as 'active' | 'archived' | 'all')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="active">Active listings</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            {STATUS_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={loadItems}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Refresh
          </button>
        </div>

        <div className="mt-3 text-xs text-slate-500">{resultsLabel}</div>

        {error && (
          <p className="mt-3 text-sm text-rose-600">{error}</p>
        )}

        {loading ? (
          <div className="mt-8 flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
          </div>
        ) : items.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No marketplace items match this filter.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {items.map((item) => {
              const busy = actionLoadingId === item.id;
              const isArchived = Boolean(item.archived_at);
              const pendingApproval = item.is_reviewed === false;
              const onHold = item.is_on_hold;
              const visibleOnMarketplace =
                !isArchived && !onHold && item.is_reviewed !== false && !item.is_expired;
              const modDisabled = busy || isArchived;
              const notes = notesByItem[item.id] || [];
              const noteBusy = notesLoading[item.id];
              const savingNote = noteSavingId === item.id;

              return (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start gap-2">
                    <button
                      type="button"
                      aria-expanded={!!expanded[item.id]}
                      aria-label={expanded[item.id] ? 'Collapse row' : 'Expand row'}
                      onClick={() => toggleRowExpanded(item.id)}
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                    >
                      {expanded[item.id] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-slate-900">{item.title || 'Untitled'}</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {item.category || 'General'} · {item.location || 'Unknown location'} · ${item.price}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Seller: {item.username ? `@${item.username}` : item.user_id}
                          {isArchived && item.archive_source ? (
                            <span className="ml-2 text-slate-400">
                              · Archived ({item.archive_source === 'admin' ? 'admin' : 'seller'})
                            </span>
                          ) : null}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          {isArchived ? (
                            <span className="rounded-full bg-slate-300 px-2 py-1 font-medium text-slate-800">
                              Archived
                            </span>
                          ) : onHold ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-700">On hold</span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-700">Live</span>
                          )}
                          {pendingApproval ? (
                            <span className="rounded-full bg-orange-100 px-2 py-1 font-medium text-orange-800">
                              Pending approval
                            </span>
                          ) : (
                            <span className="rounded-full bg-indigo-100 px-2 py-1 font-medium text-indigo-700">Approved</span>
                          )}
                          {visibleOnMarketplace && (
                            <span className="rounded-full bg-teal-100 px-2 py-1 font-medium text-teal-800">
                              On marketplace
                            </span>
                          )}
                          {item.is_expired && (
                            <span className="rounded-full bg-rose-100 px-2 py-1 font-medium text-rose-700">Expired</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={modDisabled}
                          onClick={() => openEditModal(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          disabled={modDisabled}
                          onClick={() => openEmailModal(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-50"
                        >
                          <Mail className="h-3.5 w-3.5" /> Email seller
                        </button>
                        {!isArchived && pendingApproval && onHold && (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                runItemAction(
                                  item.id,
                                  { is_reviewed: true, is_on_hold: false },
                                  'Approved and activated (visible on marketplace)'
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approve & activate
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                runItemAction(
                                  item.id,
                                  { is_reviewed: true },
                                  'Approved (still on hold—use Activate when ready to publish)'
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approve (keep on hold)
                            </button>
                          </>
                        )}
                        {!isArchived && pendingApproval && !onHold && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runItemAction(item.id, { is_reviewed: true }, 'Listing approved')
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-400 bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                          </button>
                        )}
                        {!isArchived && onHold && !pendingApproval && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runItemAction(item.id, { is_on_hold: false }, 'Listing activated (off hold)')
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-400 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            <PlayCircle className="h-3.5 w-3.5" /> Activate
                          </button>
                        )}
                        {!isArchived && !onHold && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runItemAction(item.id, { is_on_hold: true }, 'Listing put on hold')
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                          >
                            <PauseCircle className="h-3.5 w-3.5" /> Put on hold
                          </button>
                        )}
                        {!isArchived && item.is_reviewed === true && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runItemAction(item.id, { is_reviewed: false }, 'Approval removed (listing hidden)')
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Revoke approval
                          </button>
                        )}
                        {!isArchived && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => deleteItem(item.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Archive
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {expanded[item.id] && (
                    <div className="mt-4 border-t border-slate-200 pt-4 pl-10">
                      <h4 className="text-sm font-semibold text-slate-900">Admin notes</h4>
                      <p className="mt-0.5 text-xs text-slate-500">
                        History of internal notes for this listing. Delete a note if it was added by mistake.
                      </p>
                      {noteBusy ? (
                        <p className="mt-3 text-xs text-slate-500">Loading notes…</p>
                      ) : notes.length === 0 ? (
                        <p className="mt-3 text-xs text-slate-500">No notes yet.</p>
                      ) : (
                        <ul className="mt-3 space-y-3">
                          {notes.map((n) => (
                            <li
                              key={n.id}
                              className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <p className="whitespace-pre-wrap break-words">{n.body}</p>
                                <button
                                  type="button"
                                  onClick={() => deleteNote(item.id, n.id)}
                                  className="shrink-0 text-xs font-semibold text-rose-600 hover:text-rose-800"
                                >
                                  Delete
                                </button>
                              </div>
                              <p className="mt-2 text-xs text-slate-500">
                                {new Date(n.created_at).toLocaleString()}{' '}
                                {n.admin_email ? `· ${n.admin_email}` : ''}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                      <label className="mt-4 block text-xs font-medium text-slate-600">
                        Add note
                        <textarea
                          value={noteDraftByItem[item.id] || ''}
                          onChange={(e) =>
                            setNoteDraftByItem((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          rows={3}
                          placeholder="Internal note (visible to admins only)…"
                          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={savingNote}
                        onClick={() => saveNote(item.id)}
                        className="mt-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                      >
                        {savingNote ? 'Saving…' : 'Save note'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {emailItem && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={closeEmailModal}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900">Email seller</h2>
            <p className="mt-1 text-xs text-slate-500">
              Sends from <span className="font-medium text-slate-800">support@hanar.net</span> to the seller’s
              account email. Listing: <span className="font-medium">{emailItem.title || 'Untitled'}</span>
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-slate-600">
                Subject
                <input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Message
                <textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows={8}
                  placeholder="Write your message to the seller…"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEmailModal}
                disabled={emailSending}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendSellerEmail}
                disabled={emailSending}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {emailSending ? 'Sending…' : 'Send email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingItem && editForm && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={closeEditModal}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900">Edit Marketplace Item</h2>
            <p className="mt-1 text-xs text-slate-500">ID: {editingItem.id}</p>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                value={editForm.title || ''}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                placeholder="Title"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <input
                value={String(editForm.price ?? '')}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, price: e.target.value } : prev))}
                placeholder="Price"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <div className="md:col-span-2">
                <MarketplaceCategorySelects
                  value={editForm.category || ''}
                  onChange={(category) =>
                    setEditForm((prev) => (prev ? { ...prev, category } : prev))
                  }
                  labelId={`admin-marketplace-edit-${editingItem.id}`}
                  labelClassName="block text-xs font-medium text-slate-600"
                  selectClassName="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <input
                value={editForm.condition || ''}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, condition: e.target.value } : prev))}
                placeholder="Condition"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <input
                value={editForm.location || ''}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, location: e.target.value } : prev))}
                placeholder="Location"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 md:col-span-2"
              />
              <input
                value={editForm.external_buy_url || ''}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, external_buy_url: e.target.value } : prev))}
                placeholder="External buy URL"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 md:col-span-2"
              />
              <label className="text-xs font-medium text-slate-600">
                Expiration
                <input
                  type="datetime-local"
                  value={toDateTimeInputValue(editForm.expires_at)}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditForm((prev) => (prev ? { ...prev, expires_at: value || null } : prev));
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </label>
              <textarea
                value={editForm.description || ''}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                placeholder="Description"
                rows={4}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 md:col-span-2"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={savingEdit}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {savingEdit ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
