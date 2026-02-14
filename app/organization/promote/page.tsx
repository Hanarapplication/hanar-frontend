'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Redirect to shared promote page for organizations. */
export default function OrganizationPromoteRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/business-dashboard/promote?for=organization');
  }, [router]);
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
      <p className="text-slate-500 dark:text-slate-400">Redirecting to promote...</p>
    </div>
  );
}
