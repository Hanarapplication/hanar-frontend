'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

function BusinessPromoteRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { effectiveLang } = useLanguage();
  useEffect(() => {
    const forOrg = searchParams?.get('for') === 'organization';
    router.replace(forOrg ? '/promote?for=organization' : '/promote');
  }, [router, searchParams]);
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-500">{t(effectiveLang, 'Redirecting to promote...')}</p>
    </div>
  );
}

/** Redirect to shared promote form. Preserves ?for=organization if present. */
export default function BusinessPromoteRedirect() {
  const { effectiveLang } = useLanguage();
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-500">{t(effectiveLang, 'Loading...')}</p></div>}>
      <BusinessPromoteRedirectContent />
    </Suspense>
  );
}
