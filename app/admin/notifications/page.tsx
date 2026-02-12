'use client';

import Link from 'next/link';
import { Bell, Send, Radio, Users, ArrowLeft } from 'lucide-react';

export default function AdminNotificationsHubPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/admin/dashboard"
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
          <Bell className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">Send in-app or push notifications to organizations, businesses, individuals, or specific users</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/notifications/regular"
          className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <Send className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Regular notifications</h2>
            <p className="mt-1 text-sm text-slate-500">Send to every selected recipient (organizations, businesses, individuals). View and delete previous sends.</p>
          </div>
        </Link>
        <Link
          href="/admin/notifications/targeted"
          className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-violet-200 hover:shadow-md"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Targeted notifications</h2>
            <p className="mt-1 text-sm text-slate-500">Search by email, phone, or name and send only to selected users. Full page with search and receivers.</p>
          </div>
        </Link>
        <Link
          href="/admin/notifications/blast"
          className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:col-span-2 lg:col-span-1"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Radio className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Blast notifications</h2>
            <p className="mt-1 text-sm text-slate-500">Same targeting with optional area limit and in-app or push delivery. View and delete previous blasts.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
