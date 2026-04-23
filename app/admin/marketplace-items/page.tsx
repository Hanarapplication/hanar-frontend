'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Pencil, Trash2, PauseCircle, PlayCircle, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

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
  is_reviewed: boolean;
  is_expired: boolean;
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
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'unreviewed', label: 'Unreviewed' },
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
  }, [search, status]);

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
      setError(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const deleteItem = async (itemId: string) => {
    const yes = window.confirm('Delete this marketplace item permanently?');
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
      if (!res.ok) throw new Error(data?.error || 'Delete failed');
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const saveEdit = async () => {
    if (!editingItem || !editForm) return;
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
          Search and moderate individual marketplace listings: edit, delete, expiration, hold, and review.
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
              return (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-900">{item.title || 'Untitled'}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.category || 'General'} · {item.location || 'Unknown location'} · ${item.price}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Seller: {item.username ? `@${item.username}` : item.user_id}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {item.is_on_hold ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-700">On hold</span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-700">Active</span>
                        )}
                        {item.is_reviewed ? (
                          <span className="rounded-full bg-indigo-100 px-2 py-1 font-medium text-indigo-700">Reviewed</span>
                        ) : (
                          <span className="rounded-full bg-slate-200 px-2 py-1 font-medium text-slate-700">Unreviewed</span>
                        )}
                        {item.is_expired && (
                          <span className="rounded-full bg-rose-100 px-2 py-1 font-medium text-rose-700">Expired</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openEditModal(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runItemAction(
                            item.id,
                            { is_on_hold: !item.is_on_hold },
                            item.is_on_hold ? 'Item reactivated' : 'Item put on hold'
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                      >
                        {item.is_on_hold ? (
                          <>
                            <PlayCircle className="h-3.5 w-3.5" /> Unhold
                          </>
                        ) : (
                          <>
                            <PauseCircle className="h-3.5 w-3.5" /> Hold
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runItemAction(
                            item.id,
                            { is_reviewed: !item.is_reviewed },
                            item.is_reviewed ? 'Marked as unreviewed' : 'Marked as reviewed'
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                      >
                        {item.is_reviewed ? (
                          <>
                            <XCircle className="h-3.5 w-3.5" /> Unreview
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Review
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => deleteItem(item.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
              <input
                value={editForm.category || ''}
                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, category: e.target.value } : prev))}
                placeholder="Category"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
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
