'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { Mail, ArrowLeft } from 'lucide-react';

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

export default function AdminSendCustomEmailsPage() {
  const [audience, setAudience] = useState<CustomAudience>('all_users');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
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
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Custom Message</h1>
            <p className="text-sm text-slate-500">Send a custom email to an audience</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
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

        {result && (
          <div className={`mt-6 rounded-xl border px-4 py-3 ${
            result.failed > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
          }`}>
            <p className={result.failed > 0 ? 'text-sm font-semibold text-amber-800' : 'text-sm font-semibold text-emerald-800'}>
              Sent {result.sent} of {result.total} emails
              {result.failed > 0 && ` (${result.failed} failed)`}
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Emails are sent via Resend. Recipients are deduplicated by email.
      </p>
    </div>
  );
}
