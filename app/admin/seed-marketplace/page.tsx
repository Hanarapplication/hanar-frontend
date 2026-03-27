'use client';

import { useState } from 'react';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

export default function AdminSeedMarketplacePage() {
  const [loading, setLoading] = useState(false);
  const [seedUsers, setSeedUsers] = useState<string[]>([]);
  const [seedUsersLoading, setSeedUsersLoading] = useState(true);
  const [form, setForm] = useState({
    seedUsername: '',
    title: '',
    price: '',
    location: '',
    category: '',
    condition: 'New',
    description: '',
    affiliationLink: '',
    expiresAt: '',
    neverExpires: true,
    photoUrlsText: '',
  });

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    (async () => {
      setSeedUsersLoading(true);
      try {
        const res = await fetch('/api/admin/seed-marketplace');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data?.error || 'Failed to load seed users');
          setSeedUsers([]);
          return;
        }
        const users = Array.isArray(data?.seedUsers)
          ? data.seedUsers.map((u: unknown) => String(u)).filter(Boolean)
          : [];
        setSeedUsers(users);
        setForm((prev) => ({
          ...prev,
          seedUsername: prev.seedUsername || users[0] || '',
        }));
      } catch {
        toast.error('Failed to load seed users');
        setSeedUsers([]);
      } finally {
        setSeedUsersLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || seedUsersLoading || !form.seedUsername) return;
    setLoading(true);
    try {
      const photos = form.photoUrlsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      const payload = {
        seedUsername: form.seedUsername.trim() || undefined,
        title: form.title.trim(),
        price: Number(form.price),
        location: form.location.trim(),
        category: form.category.trim(),
        condition: form.condition.trim() || 'New',
        description: form.description.trim(),
        affiliationLink: form.affiliationLink.trim(),
        photos,
        expiresAt: form.neverExpires ? 'never' : (form.expiresAt || null),
      };

      const res = await fetch('/api/admin/seed-marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || 'Failed to seed item');
        return;
      }
      toast.success(data?.message || 'Marketplace seed item created');
      setForm((prev) => ({
        ...prev,
        title: '',
        price: '',
        location: '',
        category: '',
        description: '',
        affiliationLink: '',
        expiresAt: '',
        photoUrlsText: '',
      }));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to seed item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Seed Marketplace Item</h1>
      <p className="text-sm text-slate-600 mb-5">
        Add a marketplace item from admin panel using the same `seed_*` user accounts used by Community seeds.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Seed username</label>
          <select
            name="seedUsername"
            value={form.seedUsername}
            onChange={onChange}
            required
            disabled={seedUsersLoading || seedUsers.length === 0}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {seedUsersLoading ? (
              <option value="">Loading seed users...</option>
            ) : seedUsers.length === 0 ? (
              <option value="">No seed users found</option>
            ) : (
              seedUsers.map((username) => (
                <option key={username} value={username}>
                  {username}
                </option>
              ))
            )}
          </select>
          {!seedUsersLoading && seedUsers.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">
              No `seed_*` users found. Run Seed Community first.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input name="title" value={form.title} onChange={onChange} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Price</label>
            <input name="price" type="number" step="0.01" min="0" value={form.price} onChange={onChange} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
            <input name="location" value={form.location} onChange={onChange} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <input name="category" value={form.category} onChange={onChange} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Condition</label>
            <select name="condition" value={form.condition} onChange={onChange} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="New">New</option>
              <option value="Used">Used</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Affiliation link (optional)</label>
            <input name="affiliationLink" type="url" value={form.affiliationLink} onChange={onChange} placeholder="https://..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
          <textarea name="description" value={form.description} onChange={onChange} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Photo URLs (optional, one per line)</label>
          <textarea
            name="photoUrlsText"
            value={form.photoUrlsText}
            onChange={onChange}
            rows={4}
            placeholder={'https://...\nhttps://...'}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.neverExpires}
              onChange={(e) => setForm((prev) => ({ ...prev, neverExpires: e.target.checked }))}
            />
            Never expires
          </label>
          {!form.neverExpires && (
            <div className="mt-2">
              <label className="block text-sm text-slate-700 mb-1">Expires at</label>
              <input
                name="expiresAt"
                type="datetime-local"
                value={form.expiresAt}
                onChange={onChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || seedUsersLoading || seedUsers.length === 0}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Adding...' : 'Add marketplace seed item'}
        </button>
      </form>
    </div>
  );
}
