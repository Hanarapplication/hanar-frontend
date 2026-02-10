'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { KeyRound, ArrowLeft } from 'lucide-react';

type LoginAudience =
  | 'all_businesses'
  | 'all_organizations'
  | 'business_admin_added'
  | 'organization_admin_added'
  | 'individual_business'
  | 'individual_organization';

const LOGIN_AUDIENCE_OPTIONS: { value: LoginAudience; label: string }[] = [
  { value: 'all_businesses', label: 'All businesses' },
  { value: 'all_organizations', label: 'All organizations' },
  { value: 'business_admin_added', label: 'Businesses: Admin-added only' },
  { value: 'organization_admin_added', label: 'Organizations: Admin-added only' },
  { value: 'individual_business', label: 'One business (select below)' },
  { value: 'individual_organization', label: 'One organization (select below)' },
];

interface Business { id: string; business_name: string; email: string | null; slug: string }
interface Organization { id: string; full_name: string | null; username: string | null; email: string | null }

export default function AdminSendLoginEmailsPage() {
  const [loginAudience, setLoginAudience] = useState<LoginAudience>('all_businesses');
  const [subject, setSubject] = useState('');
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    sent: number;
    failed: number;
    total: number;
    failedDetails?: { email: string; reason: string }[];
  } | null>(null);

  useEffect(() => {
    if (loginAudience === 'individual_business' || loginAudience === 'individual_organization') {
      setListsLoading(true);
      Promise.all([
        fetch('/api/admin/businesses').then((r) => r.json()).then((d) => d.businesses || []),
        fetch('/api/admin/organizations').then((r) => r.json()).then((d) => d.organizations || []),
      ])
        .then(([biz, org]) => {
          setBusinesses(biz);
          setOrganizations(org);
        })
        .catch(() => toast.error('Failed to load lists'))
        .finally(() => setListsLoading(false));
    } else {
      setBusinesses([]);
      setOrganizations([]);
    }
  }, [loginAudience]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginAudience === 'individual_business' && !selectedBusinessId) {
      toast.error('Select a business');
      return;
    }
    if (loginAudience === 'individual_organization' && !selectedOrgId) {
      toast.error('Select an organization');
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const payload: Record<string, unknown> = {
        audience: loginAudience,
        subject: subject.trim() || undefined,
      };
      if (loginAudience === 'individual_business') payload.businessId = selectedBusinessId;
      if (loginAudience === 'individual_organization') payload.organizationId = selectedOrgId;

      const res = await fetch('/api/admin/send-login-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
      setResult({
        sent: data.sent ?? 0,
        failed: data.failed ?? 0,
        total: data.total ?? 0,
        failedDetails: data.failedDetails,
      });
      if ((data.failed ?? 0) > 0 && data.failedDetails?.[0]) {
        toast.error(data.failedDetails[0].reason);
      } else {
        toast.success(data?.message || `Sent ${data.sent} login emails`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send login emails');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/send-emails"
        className="mb-6 inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Send Emails
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-lg p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Login + OTP</h1>
            <p className="text-sm text-slate-500">Send login credentials with a one-time password</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Recipients</label>
            <select
              value={loginAudience}
              onChange={(e) => {
                setLoginAudience(e.target.value as LoginAudience);
                setSelectedBusinessId('');
                setSelectedOrgId('');
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              disabled={sending}
            >
              {LOGIN_AUDIENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {loginAudience === 'individual_business' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Select business</label>
              <select
                value={selectedBusinessId}
                onChange={(e) => setSelectedBusinessId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900"
                disabled={sending || listsLoading}
              >
                <option value="">— Select —</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>{b.business_name || b.slug} {b.email ? `(${b.email})` : ''}</option>
                ))}
              </select>
            </div>
          )}

          {loginAudience === 'individual_organization' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Select organization</label>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900"
                disabled={sending || listsLoading}
              >
                <option value="">— Select —</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>{o.full_name || o.username || o.id} {o.email ? `(${o.email})` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Subject (optional)</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Default: Your Hanar Login Credentials"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              disabled={sending}
              maxLength={200}
            />
          </div>
          <p className="text-sm text-slate-500">
            Each recipient will receive an email with their login (email) and a new one-time password. Their password will be updated.
          </p>
          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow-md transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sending...
              </span>
            ) : (
              'Send Login Emails'
            )}
          </button>
        </form>

        {result && (
          <div className={`mt-6 rounded-xl border px-4 py-3 ${
            result.failed > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
          }`}>
            <p className={result.failed > 0 ? 'text-sm font-semibold text-amber-800' : 'text-sm font-semibold text-emerald-800'}>
              Sent {result.sent} of {result.total} emails
              {result.failed > 0 && ` (${result.failed} failed)`}
            </p>
            {result.failedDetails && result.failedDetails.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-amber-700">
                {result.failedDetails.map((d, i) => (
                  <li key={i}>
                    <strong>{d.email}</strong>: {d.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Emails are sent via Resend. Recipients are deduplicated by email.
      </p>
    </div>
  );
}
