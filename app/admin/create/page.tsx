'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Building2, Users } from 'lucide-react';
import toast from 'react-hot-toast';

type Tab = 'business' | 'organization';

export default function AdminCreatePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('business');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [businessForm, setBusinessForm] = useState({
    business_name: '',
    email: '',
    password: '',
    full_name: '',
    phone: '',
    description: '',
  });

  const [orgForm, setOrgForm] = useState({
    full_name: '',
    email: '',
    password: '',
  });

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!businessForm.business_name.trim() || !businessForm.email.trim() || !businessForm.password.trim()) {
      toast.error('Business name, email, and password are required');
      return;
    }
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/admin/create-business', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          business_name: businessForm.business_name.trim(),
          email: businessForm.email.trim().toLowerCase(),
          password: businessForm.password,
          full_name: businessForm.full_name.trim() || businessForm.business_name.trim(),
          phone: businessForm.phone.trim() || undefined,
          description: businessForm.description.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || `Request failed: ${res.status}`);
      }

      toast.success(`Business created: ${data.slug || data.business_id}`);
      setBusinessForm({ business_name: '', email: '', password: '', full_name: '', phone: '', description: '' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create business';
      toast.error(msg);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!orgForm.full_name.trim() || !orgForm.email.trim() || !orgForm.password.trim()) {
      toast.error('Full name, email, and password are required');
      return;
    }
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/admin/create-organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          full_name: orgForm.full_name.trim(),
          email: orgForm.email.trim().toLowerCase(),
          password: orgForm.password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || `Request failed: ${res.status}`);
      }

      toast.success(`Organization created: @${data.username || 'org'}`);
      setOrgForm({ full_name: '', email: '', password: '' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create organization';
      toast.error(msg);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push('/admin/owner')}
          className="mb-6 inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-4">
            <h1 className="text-xl font-bold text-slate-900 py-4">Create Business or Organization</h1>
            <p className="text-sm text-slate-600 pb-4">
              Admin-created businesses and organizations are marked with admin_added_at / admin_added_by so you can email them separately.
            </p>
            <div className="flex gap-2 pb-4">
              <button
                onClick={() => setTab('business')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  tab === 'business' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Building2 className="h-4 w-4" />
                Create Business
              </button>
              <button
                onClick={() => setTab('organization')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  tab === 'organization' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Users className="h-4 w-4" />
                Create Organization
              </button>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            {tab === 'business' && (
              <form onSubmit={handleCreateBusiness} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Business Name *</label>
                  <input
                    type="text"
                    value={businessForm.business_name}
                    onChange={(e) => setBusinessForm((p) => ({ ...p, business_name: e.target.value }))}
                    placeholder="e.g. Acme Retail"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Contact Name (optional)</label>
                  <input
                    type="text"
                    value={businessForm.full_name}
                    onChange={(e) => setBusinessForm((p) => ({ ...p, full_name: e.target.value }))}
                    placeholder="e.g. John Smith"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={businessForm.email}
                    onChange={(e) => setBusinessForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="business@example.com"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Password *</label>
                  <input
                    type="password"
                    value={businessForm.password}
                    onChange={(e) => setBusinessForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    required
                    minLength={6}
                  />
                  <p className="mt-1 text-xs text-slate-500">User can change this after first login</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Phone (optional)</label>
                  <input
                    type="tel"
                    value={businessForm.phone}
                    onChange={(e) => setBusinessForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+1 234 567 8900"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Description (optional)</label>
                  <textarea
                    value={businessForm.description}
                    onChange={(e) => setBusinessForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Brief description..."
                    rows={3}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow-md transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating...' : 'Create Business'}
                </button>
              </form>
            )}

            {tab === 'organization' && (
              <form onSubmit={handleCreateOrganization} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Organization Name *</label>
                  <input
                    type="text"
                    value={orgForm.full_name}
                    onChange={(e) => setOrgForm((p) => ({ ...p, full_name: e.target.value }))}
                    placeholder="e.g. Community Foundation"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={orgForm.email}
                    onChange={(e) => setOrgForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="org@example.com"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Password *</label>
                  <input
                    type="password"
                    value={orgForm.password}
                    onChange={(e) => setOrgForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    required
                    minLength={6}
                  />
                  <p className="mt-1 text-xs text-slate-500">User can change this after first login</p>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow-md transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating...' : 'Create Organization'}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500 text-center">
          Admin-created records have admin_added_at and admin_added_by set. Use &quot;Admin-added businesses&quot; or &quot;Admin-added organizations&quot; in Email Users to target them.
        </p>
      </div>
    </div>
  );
}
