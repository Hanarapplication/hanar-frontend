'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Users, Globe, Tag, Ban, CircleHelp, Phone, Settings, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { DashboardBurgerMenu } from '@/components/DashboardBurgerMenu';
import { DashboardBlockedAccountsPanel } from '@/components/DashboardBlockedAccountsPanel';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

function BlockedAccountsContent() {
  const router = useRouter();
  const { effectiveLang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [burgerMenuOpen, setBurgerMenuOpen] = useState(false);

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
          .select('business, organization')
          .eq('user_id', user.id)
          .maybeSingle();
        if (regProfile?.business === true) {
          router.replace('/business-dashboard');
          return;
        }
        if (regProfile?.organization === true) {
          router.replace('/organization/dashboard');
          return;
        }
        const [{ data: prof }, { data: reg }] = await Promise.all([
          supabase.from('profiles').select('username').eq('id', user.id).maybeSingle(),
          supabase.from('registeredaccounts').select('username').eq('user_id', user.id).maybeSingle(),
        ]);
        if (cancelled) return;
        setProfileUsername(prof?.username ?? reg?.username ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleHeaderLogout = async () => {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userType');
    }
    router.push('/login');
  };

  const burgerItems = useMemo(
    () => [
      ...(profileUsername
        ? [
            {
              label: t(effectiveLang, 'View Profile'),
              href: `/profile/${profileUsername}`,
              icon: <User className="h-5 w-5 shrink-0" />,
              color: 'bg-indigo-50 dark:bg-indigo-900/30',
            },
          ]
        : []),
      {
        label: t(effectiveLang, 'Followers only'),
        subtitle: t(effectiveLang, 'Post to your profile — only followers see it'),
        href: '/community/post?visibility=profile',
        icon: <Users className="h-5 w-5 shrink-0" />,
        color: 'bg-violet-50 dark:bg-violet-900/30',
      },
      {
        label: t(effectiveLang, 'Public (Community)'),
        subtitle: t(effectiveLang, 'Post to Community feed — everyone can see it'),
        href: '/community/post?visibility=community',
        icon: <Globe className="h-5 w-5 shrink-0" />,
        color: 'bg-rose-50 dark:bg-rose-900/30',
      },
      {
        label: t(effectiveLang, 'Blocked accounts'),
        subtitle: t(effectiveLang, 'People you blocked or who blocked you'),
        href: '/dashboard/blocked',
        icon: <Ban className="h-5 w-5 shrink-0" />,
        color: 'bg-slate-100 dark:bg-gray-800/80',
      },
      {
        label: t(effectiveLang, 'Sell Item'),
        href: '/marketplace/post',
        icon: <Tag className="h-5 w-5 shrink-0" />,
        color: 'bg-emerald-50 dark:bg-emerald-900/30',
      },
      {
        label: t(effectiveLang, 'faq'),
        href: '/faq',
        icon: <CircleHelp className="h-5 w-5 shrink-0" />,
        color: 'bg-blue-50 dark:bg-blue-900/30',
      },
      {
        label: t(effectiveLang, 'contact'),
        href: '/contact',
        icon: <Phone className="h-5 w-5 shrink-0" />,
        color: 'bg-cyan-50 dark:bg-cyan-900/30',
      },
      {
        label: t(effectiveLang, 'settings'),
        href: '/settings',
        icon: <Settings className="h-5 w-5 shrink-0" />,
        color: 'bg-slate-100 dark:bg-slate-800/80',
      },
      {
        label: t(effectiveLang, 'logout'),
        onClick: handleHeaderLogout,
        icon: <LogOut className="h-5 w-5 shrink-0" />,
        color: 'bg-slate-200 dark:bg-slate-700/80',
      },
    ],
    [effectiveLang, profileUsername, router],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gray-900 px-4 pt-14">
        <p className="text-slate-500 dark:text-gray-400">{t(effectiveLang, 'Loading...')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 px-4 pt-14 pb-10">
      <DashboardBurgerMenu open={burgerMenuOpen} onOpen={() => setBurgerMenuOpen(true)} onClose={() => setBurgerMenuOpen(false)} items={burgerItems} />
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400"
        >
          <ArrowLeft className="h-4 w-4" />
          {t(effectiveLang, 'Back to dashboard')}
        </Link>
        <DashboardBlockedAccountsPanel ready />
      </div>
    </div>
  );
}

export default function DashboardBlockedPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">Loading...</div>}>
      <BlockedAccountsContent />
    </Suspense>
  );
}
