'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { Mail, ArrowLeft, KeyRound } from 'lucide-react';

type CustomAudience =
  | 'all_users'
  | 'individuals'
  | 'organizations'
  | 'businesses'
  | 'business_admin_added'
  | 'organization_admin_added'
  | 'business_free'
  | 'business_starter'
  | 'business_growth'
  | 'business_premium'
  | 'business_free_trial';

type LoginAudience =
  | 'all_businesses'
  | 'all_organizations'
  | 'business_admin_added'
  | 'organization_admin_added'
  | 'individual_business'
  | 'individual_organization';

const CUSTOM_AUDIENCE_OPTIONS: { value: CustomAudience; label: string }[] = [
  { value: 'all_users', label: 'All users (individuals + organizations + businesses)' },
  { value: 'individuals', label: 'Individuals only' },
  { value: 'organizations', label: 'Organizations only' },
  { value: 'organization_admin_added', label: 'Organizations: Admin-added only' },
  { value: 'businesses', label: 'All businesses' },
  { value: 'business_admin_added', label: 'Businesses: Admin-added only' },
  { value: 'business_free', label: 'Businesses: Free plan' },
  { value: 'business_starter', label: 'Businesses: Starter plan' },
  { value: 'business_growth', label: 'Businesses: Growth plan' },
  { value: 'business_premium', label: 'Businesses: Premium plan' },
  { value: 'business_free_trial', label: 'Businesses: Premium free trial only' },
];

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

export default function AdminSendEmailsPage() {
  const router = useRouter();
  const [emailType, setEmailType] = useState<'custom' | 'login'>('custom');

  const [audience, setAudience] = useState<CustomAudience>('all_users');
  const [loginAudience, setLoginAudience] = useState<LoginAudience>('all_businesses');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
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
    if (emailType === 'login' && (loginAudience === 'individual_business' || loginAudience === 'individual_organization')) {
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
  }, [emailType, loginAudience]);

  const handleSubmitCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      toast.error('Subject and message are required');
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/admin/send-business-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ audience, subject: subject.trim(), body: body.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
      setResult({ sent: data.sent ?? 0, failed: data.failed ?? 0, total: data.total ?? 0 });
      toast.success(data?.message || `Sent ${data.sent} emails`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send emails');
    } finally {
      setSending(false);
    }
  };

  const handleSubmitLogin = async (e: React.FormEvent) => {
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push('/admin/owner')}
          className="mb-6 inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-lg p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Email Users</h1>
              <p className="text-sm text-slate-500">Send custom emails or login credentials with one-time password</p>
            </div>
          </div>

          {/* Email type tabs */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => { setEmailType('custom'); setResult(null); }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold transition ${
                emailType === 'custom'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Mail className="h-4 w-4" />
              Custom Message
            </button>
            <button
              type="button"
              onClick={() => { setEmailType('login'); setResult(null); }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold transition ${
                emailType === 'login'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <KeyRound className="h-4 w-4" />
              Login + OTP
            </button>
          </div>

          {emailType === 'custom' ? (
            <form onSubmit={handleSubmitCustom} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Audience</label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as CustomAudience)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  disabled={sending}
                >
                  {CUSTOM_AUDIENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Your Premium trial ends soon"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  disabled={sending}
                  maxLength={200}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your message here."
                  rows={8}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y"
                  disabled={sending}
                />
              </div>
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
                  'Send Emails'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmitLogin} className="space-y-5">
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
          )}

          {result && (
            <div className={`mt-6 rounded-xl border px-4 py-3 ${
              result.failed > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
            }`}>
              <p className={`text-sm font-semibold ${
                result.failed > 0 ? 'text-amber-800' : 'text-emerald-800'
              }`}>
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

        <p className="mt-4 text-xs text-slate-500 text-center">
          Emails are sent via Resend. Recipients are deduplicated by email.
        </p>
      </div>
    </div>
  );
}
