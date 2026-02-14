'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

type BusinessAdmin = {
  user_id: string;
  email: string;
  role: string;
  label: string;
};

export default function AdminAdminsPage() {
  const [admins, setAdmins] = useState<BusinessAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchAdmins();
  }, []);

  async function fetchAdmins() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/admins');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load admins');
      setAdmins(data.admins || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load admins');
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      toast.error('Email and password are required.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (password !== passwordConfirm) {
      toast.error('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to add admin');
      toast.success(data.message || 'Business account admin added.');
      setEmail('');
      setPassword('');
      setPasswordConfirm('');
      fetchAdmins();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add admin');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Admins — Business accounts</h1>
      <p className="text-slate-600 text-sm mb-6">
        Add admin users that can sign in to the admin panel with email and password. They are labeled as <strong>Business account</strong>.
      </p>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Add new admin</h2>
        <form onSubmit={handleAddAdmin} className="space-y-4">
          <div>
            <label htmlFor="admin-email" className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              autoComplete="off"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">At least 6 characters</p>
          </div>
          <div>
            <label htmlFor="admin-password-confirm" className="block text-sm font-medium text-slate-700 mb-1">
              Confirm password
            </label>
            <input
              id="admin-password-confirm"
              type={showPassword ? 'text' : 'password'}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="admin-show-password"
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="admin-show-password" className="text-sm text-slate-700 cursor-pointer">
              Show password
            </label>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Adding…' : 'Add admin'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <h2 className="text-lg font-semibold text-slate-800 p-4 border-b border-slate-200">
          Business account admins
        </h2>
        {loading ? (
          <div className="p-6 text-center text-slate-500">Loading…</div>
        ) : admins.length === 0 ? (
          <div className="p-6 text-center text-slate-500">No business account admins yet. Add one above.</div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {admins.map((a) => (
              <li key={a.user_id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-medium text-slate-900">{a.email}</span>
                  <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {a.label}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-slate-500 text-sm mt-4">
        These admins sign in at the admin login page with their email and password.
      </p>
    </div>
  );
}
