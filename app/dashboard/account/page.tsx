'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { User, Crown, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';
import { isAppIOS, withAppParam } from '@/utils/isAppIOS';

function DashboardAccountContent() {
  const { effectiveLang } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const appIOS = isAppIOS(searchParams?.toString() ?? null);

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ email?: string; fullName?: string } | null>(null);
  const [business, setBusiness] = useState<{ plan: string; business_name?: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.replace('/login');
          return;
        }

        const fullName = authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? '';
        const email = authUser.email ?? '';
        setUser({ email, fullName: fullName || undefined });

        const { data: reg } = await supabase
          .from('registeredaccounts')
          .select('full_name')
          .eq('user_id', authUser.id)
          .maybeSingle();
        if (reg?.full_name && !fullName) {
          setUser((u) => ({ ...u, fullName: reg.full_name }));
        }

        const { data: biz } = await supabase
          .from('businesses')
          .select('plan, business_name')
          .eq('owner_id', authUser.id)
          .maybeSingle();
        if (biz) {
          setBusiness({ plan: biz.plan || 'free', business_name: biz.business_name });
        }
      } catch (err) {
        console.error('Account load error', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  const planLabel = business?.plan
    ? String(business.plan).charAt(0).toUpperCase() + String(business.plan).slice(1)
    : t(effectiveLang, 'Free');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-lg font-medium text-gray-600 dark:text-gray-400 animate-pulse">
          {t(effectiveLang, 'Loading...')}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4 pt-16 pb-12">
      <div className="max-w-xl mx-auto">
        <Link
          href={appIOS ? withAppParam('/dashboard', true) : '/dashboard'}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t(effectiveLang, 'Back')}
        </Link>

        <div className="rounded-3xl border-2 border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-6 sm:p-8">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {t(effectiveLang, 'Account')}
          </h1>

          <div className="mt-6 space-y-6">
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50/50 dark:bg-gray-700/50 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
                <User className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
                  {t(effectiveLang, 'Name')}
                </p>
                <p className="font-medium text-slate-900 dark:text-gray-100">
                  {user?.fullName || t(effectiveLang, 'Not set')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50/50 dark:bg-gray-700/50 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                <span className="text-lg">@</span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
                  {t(effectiveLang, 'Email')}
                </p>
                <p className="font-medium text-slate-900 dark:text-gray-100 break-all">
                  {user?.email || t(effectiveLang, 'Not set')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50/50 dark:bg-gray-700/50 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                <Crown className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
                  {t(effectiveLang, 'Plan')}
                </p>
                <p className="font-medium text-slate-900 dark:text-gray-100">
                  {business ? planLabel : t(effectiveLang, 'Free')}
                </p>
                {business?.business_name && (
                  <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
                    {business.business_name}
                  </p>
                )}
              </div>
            </div>
          </div>

          {business && (
            <div className="mt-8">
              <Link
                href={appIOS ? withAppParam('/business/plan', true) : '/business/plan'}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                <Crown className="h-4 w-4" />
                {t(effectiveLang, 'Manage Plan')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardAccountPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">Loading...</div>}>
      <DashboardAccountContent />
    </Suspense>
  );
}
