'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

/** Redirect to shared promote form (organization mode). */
export default function OrganizationPromoteRedirect() {
  const router = useRouter();
  const { effectiveLang } = useLanguage();
  useEffect(() => {
    router.replace('/promote?for=organization');
  }, [router]);
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
      <p className="text-slate-500 dark:text-slate-400">{t(effectiveLang, 'Redirecting to promote...')}</p>
    </div>
  );
}
