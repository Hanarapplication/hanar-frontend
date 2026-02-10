'use client';

import Link from 'next/link';
import { Mail, KeyRound } from 'lucide-react';

export default function AdminSendEmailsLandingPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Send Emails</h1>
      <p className="mt-1 text-slate-600">Choose how you want to email users.</p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/admin/send-emails/custom"
          className="flex flex-col items-start p-6 rounded-xl border-2 border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all text-left"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 mb-4">
            <Mail className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Custom Message</h2>
          <p className="mt-1 text-sm text-slate-500">
            Send a custom email to an audience (all users, businesses, organizations, or by plan).
          </p>
        </Link>

        <Link
          href="/admin/send-emails/login"
          className="flex flex-col items-start p-6 rounded-xl border-2 border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all text-left"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 mb-4">
            <KeyRound className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Login + OTP</h2>
          <p className="mt-1 text-sm text-slate-500">
            Send login credentials with a one-time password to businesses or organizations.
          </p>
        </Link>
      </div>
    </div>
  );
}
