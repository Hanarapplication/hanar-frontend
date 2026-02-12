'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Cookies from 'js-cookie';

const OWNER_LINKS: { label: string; path: string; description: string }[] = [
  { label: 'Business Approvals', path: '/admin/approvals', description: 'Review and approve new businesses' },
  { label: 'Notification Requests', path: '/admin/notification-requests', description: 'Review business notification requests' },
  { label: 'Organizations', path: '/admin/organizations', description: 'Manage organizations' },
  { label: 'Create Business / Org', path: '/admin/create', description: 'Create a business or organization' },
  { label: 'Send Emails', path: '/admin/send-emails', description: 'Email businesses or send login + OTP' },
  { label: 'Send Notifications', path: '/admin/notifications', description: 'Send in-app notifications to organizations, businesses, or individuals (direct or blast)' },
  { label: 'Community Moderation', path: '/admin/community-moderation', description: 'Moderate community content' },
  { label: 'Moderation', path: '/admin/moderation', description: 'Content moderation' },
];

const PLACEHOLDER_LINKS: { label: string; description: string }[] = [
  { label: 'Manage Ad Requests', description: 'Coming soon' },
  { label: 'Manage Homepage Banners', description: 'Coming soon' },
  { label: 'Review Reported Content', description: 'Coming soon' },
];

export default function OwnerAdminPage() {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const storedRole = Cookies.get('adminRole');
    if (storedRole === 'owner') {
      setIsAuthorized(true);
    } else {
      router.push('/unauthorized');
    }
  }, [router]);

  if (isAuthorized === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">Owner Panel</h1>
      <p className="mt-1 text-slate-600">
        Full access to Hanar platform features. Use the sidebar or the links below.
      </p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {OWNER_LINKS.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className="block p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all text-left"
          >
            <h2 className="font-semibold text-slate-900">{item.label}</h2>
            <p className="mt-1 text-sm text-slate-500">{item.description}</p>
          </Link>
        ))}
        {PLACEHOLDER_LINKS.map((item) => (
          <div
            key={item.label}
            className="block p-4 rounded-xl border border-slate-200 bg-slate-50 text-left opacity-90"
          >
            <h2 className="font-semibold text-slate-700">{item.label}</h2>
            <p className="mt-1 text-sm text-slate-500">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
