'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Ban, Bell, Edit, Megaphone, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { DashboardBurgerMenu } from '@/components/DashboardBurgerMenu';
import { DashboardBlockedAccountsPanel } from '@/components/DashboardBlockedAccountsPanel';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

function OrganizationBlockedContent() {
  const router = useRouter();
  const { effectiveLang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [burgerMenuOpen, setBurgerMenuOpen] = useState(false);

  const orgBurgerItems = useMemo(
    () => [
      { label: t(effectiveLang, 'Edit Organization'), href: '/organization/dashboard#edit-profile', icon: <Edit className="h-5 w-5 shrink-0" />, color: 'bg-blue-50 dark:bg-blue-900/30' },
      { label: t(effectiveLang, 'Send Notification'), href: '/organization/dashboard', icon: <Bell className="h-5 w-5 shrink-0" />, color: 'bg-emerald-50 dark:bg-emerald-900/30' },
      { label: t(effectiveLang, 'Promote Event / Message'), href: '/promote?for=organization', icon: <Megaphone className="h-5 w-5 shrink-0" />, color: 'bg-orange-50 dark:bg-orange-900/30' },
      { label: t(effectiveLang, 'Blocked accounts'), href: '/organization/dashboard/blocked', icon: <Ban className="h-5 w-5 shrink-0" />, color: 'bg-slate-100 dark:bg-gray-800/80' },
      { label: t(effectiveLang, 'Delete My Account'), href: '/settings', icon: <Trash2 className="h-5 w-5 shrink-0" />, color: 'bg-red-50 dark:bg-red-900/30' },
    ],
    [effectiveLang],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let { data: { session } } = await supabase.auth.getSession();
        let user = session?.user;
        if (!user) {
          await new Promise((r) => setTimeout(r, 200));
          const retry = await supabase.auth.getSession();
          user = retry.data.session?.user;
        }
        if (!user) {
          router.replace('/login');
          return;
        }
        const { data: regProfile } = await supabase
          .from('registeredaccounts')
          .select('organization')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!regProfile?.organization) {
          router.replace('/dashboard');
          return;
        }
        if (!cancelled) setAllowed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 pt-16">
        <p className="text-slate-500 dark:text-gray-400">{t(effectiveLang, 'Loading...')}</p>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-slate-50 pt-16 pb-10">
      <DashboardBurgerMenu open={burgerMenuOpen} onOpen={() => setBurgerMenuOpen(true)} onClose={() => setBurgerMenuOpen(false)} items={orgBurgerItems} />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/organization/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400"
        >
          <ArrowLeft className="h-4 w-4" />
          {t(effectiveLang, 'Back to dashboard')}
        </Link>
        <div className="mt-6">
          <DashboardBlockedAccountsPanel
            ready
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      </main>
    </div>
  );
}

export default function OrganizationDashboardBlockedPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50">Loading...</div>}>
      <OrganizationBlockedContent />
    </Suspense>
  );
}
