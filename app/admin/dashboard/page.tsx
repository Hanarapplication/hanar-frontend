'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  ClipboardCheck,
  Bell,
  MessageSquare,
  Mail,
  FileText,
  ChevronRight,
  ImageIcon,
  Users,
  Flag,
  Megaphone,
} from 'lucide-react';

type DashboardCounts = {
  businesses_pending_approval: number;
  notification_requests_pending: number;
  reported_posts: number;
  reported_comments: number;
  contact_us_to_review: number;
  feed_banners_on_hold: number;
  organizations_needing_attention: number;
  unread_reports: number;
  promotion_requests_pending: number;
};

const TASKS: {
  key: keyof DashboardCounts;
  label: string;
  path: string;
  icon: React.ReactNode;
}[] = [
  { key: 'businesses_pending_approval', label: 'Businesses pending approval', path: '/admin/approvals', icon: <ClipboardCheck className="h-5 w-5" /> },
  { key: 'notification_requests_pending', label: 'Notification requests to approve', path: '/admin/notification-requests', icon: <Bell className="h-5 w-5" /> },
  { key: 'promotion_requests_pending', label: 'Promotion requests to review', path: '/admin/promotion-requests', icon: <Megaphone className="h-5 w-5" /> },
  { key: 'feed_banners_on_hold', label: 'Feed banners on hold', path: '/admin/feed-banners', icon: <ImageIcon className="h-5 w-5" /> },
  { key: 'organizations_needing_attention', label: 'Organizations (on hold or rejected)', path: '/admin/organizations', icon: <Users className="h-5 w-5" /> },
  { key: 'reported_posts', label: 'Reported posts', path: '/admin/community-moderation', icon: <FileText className="h-5 w-5" /> },
  { key: 'reported_comments', label: 'Reported comments', path: '/admin/moderation', icon: <MessageSquare className="h-5 w-5" /> },
  { key: 'contact_us_to_review', label: 'Contact us to review', path: '/admin/contact', icon: <Mail className="h-5 w-5" /> },
  { key: 'unread_reports', label: 'User reports to review', path: '/admin/reports', icon: <Flag className="h-5 w-5" /> },
];

export default function AdminDashboard() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [countsError, setCountsError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/admin-login');
        return;
      }
      setUserEmail(user.email ?? null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch('/api/admin/dashboard-counts', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setCounts(data);
        } else {
          setCountsError(data?.error || 'Failed to load task counts');
        }
      } catch (e) {
        setCountsError(e instanceof Error ? e.message : 'Failed to load counts');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  const totalAttention = counts
    ? TASKS.reduce((sum, t) => sum + (counts[t.key] ?? 0), 0)
    : 0;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">Insight</h1>
      <p className="mt-1 text-slate-600">
        {userEmail ? `Signed in as ${userEmail}` : 'Admin'} · Tasks that need your attention.
      </p>

      {countsError && (
        <p className="mt-4 text-sm text-amber-600">{countsError}</p>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Tasks to do</h2>
        {counts && totalAttention === 0 && (
          <p className="text-slate-500 text-sm py-4">No pending tasks right now.</p>
        )}
        {counts && totalAttention > 0 && (
          <ul className="space-y-2">
            {TASKS.filter((task) => (counts[task.key] ?? 0) > 0).map((task) => {
              const count = counts[task.key] ?? 0;
              return (
                <li key={task.key}>
                  <Link
                    href={task.path}
                    className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      {task.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-slate-900">{task.label}</span>
                      <span className="ml-2 inline-flex items-center justify-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        {count}
                      </span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-6 text-sm text-slate-500">
        Use the menu to open Business Approvals, Organizations, Send Emails, Moderation, and more.
      </p>
    </div>
  );
}
