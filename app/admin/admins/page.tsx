'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

type BusinessAdmin = {
  user_id: string;
  email: string;
  role: string;
  label: string;
  first_name: string;
  last_name: string;
  employee_id: string | null;
  pin_code: string | null;
  pin_failures: number;
  is_on_hold: boolean;
};

export default function AdminAdminsPage() {
  const [admins, setAdmins] = useState<BusinessAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoadingByUser, setActionLoadingByUser] = useState<Record<string, boolean>>({});
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
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
    const safeFirstName = firstName.trim();
    const safeLastName = lastName.trim();
    const safeEmployeeId = employeeId.trim();
    if (!trimmedEmail || !password || !safeFirstName || !safeLastName || !safeEmployeeId) {
      toast.error('Email, name, employee ID, and password are required.');
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
        body: JSON.stringify({
          email: trimmedEmail,
          firstName: safeFirstName,
          lastName: safeLastName,
          employeeId: safeEmployeeId,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to add admin');
      toast.success(data.message || 'Business account admin added.');
      if (data?.pinCode) {
        toast(`Generated 4-digit security code: ${data.pinCode}`, { duration: 6000 });
      }
      setEmail('');
      setFirstName('');
      setLastName('');
      setEmployeeId('');
      setPassword('');
      setPasswordConfirm('');
      fetchAdmins();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add admin');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdminAction(
    userId: string,
    action: 'reissue_pin' | 'reopen_access' | 'reissue_and_reopen'
  ) {
    setActionLoadingByUser((prev) => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Action failed');
      toast.success(data?.message || 'Updated.');
      if (data?.pinCode) {
        toast(`New 4-digit security code: ${data.pinCode}`, { duration: 6000 });
      }
      fetchAdmins();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoadingByUser((prev) => ({ ...prev, [userId]: false }));
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Admins — Business accounts</h1>
      <p className="text-slate-600 text-sm mb-6">
        Add admin users with name, employee ID, and unique 4-digit security code.
        After email/password, they must enter this code to sign in.
        After 3 wrong attempts, account goes on hold until owner reopens/reissues.
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>
          <div>
            <label htmlFor="admin-first-name" className="block text-sm font-medium text-slate-700 mb-1">
              First name
            </label>
            <input
              id="admin-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>
          <div>
            <label htmlFor="admin-last-name" className="block text-sm font-medium text-slate-700 mb-1">
              Last name
            </label>
            <input
              id="admin-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>
          <div>
            <label htmlFor="admin-employee-id" className="block text-sm font-medium text-slate-700 mb-1">
              Employee ID
            </label>
            <input
              id="admin-employee-id"
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="EMP-1002"
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="admin-show-password"
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <label htmlFor="admin-show-password" className="text-sm text-slate-700 cursor-pointer">
              Show password
            </label>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <li key={a.user_id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="font-medium text-slate-900">{a.email}</span>
                    <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {a.label}
                    </span>
                    <p className="mt-1 text-xs text-slate-600">
                      {a.first_name} {a.last_name} · Employee ID: {a.employee_id || '—'}
                    </p>
                    <p className="mt-1 text-xs text-slate-700">
                      Security code:{' '}
                      <span className="font-mono font-semibold tracking-wider">{a.pin_code || '—'}</span>
                      {' · '}
                      Attempts: {a.pin_failures || 0}
                    </p>
                    <p className={`mt-1 text-xs font-medium ${a.is_on_hold ? 'text-red-600' : 'text-emerald-600'}`}>
                      {a.is_on_hold ? 'On hold (locked after 3 failed PIN attempts)' : 'Active'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAdminAction(a.user_id, 'reissue_pin')}
                      disabled={!!actionLoadingByUser[a.user_id]}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Reissue code
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdminAction(a.user_id, 'reopen_access')}
                      disabled={!!actionLoadingByUser[a.user_id]}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Reopen access
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdminAction(a.user_id, 'reissue_and_reopen')}
                      disabled={!!actionLoadingByUser[a.user_id]}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      Reissue + reopen
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-slate-500 text-sm mt-4">
        These admins sign in with email + password, then their 4-digit security code.
      </p>
    </div>
  );
}
