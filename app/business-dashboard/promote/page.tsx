'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/** Redirect to shared promote form. Preserves ?for=organization if present. */
export default function BusinessPromoteRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const forOrg = searchParams?.get('for') === 'organization';
    router.replace(forOrg ? '/promote?for=organization' : '/promote');
  }, [router, searchParams]);
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-500">Redirecting to promote...</p>
    </div>
  );
}
