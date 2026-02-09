'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AtUsernamePage() {
  const { username } = useParams();
  const router = useRouter();

  useEffect(() => {
    const handle = typeof username === 'string' ? String(username).replace(/^@/, '') : '';
    if (handle) {
      router.replace(`/profile/${handle}`);
    }
  }, [username, router]);
  return (
    <div className="min-h-screen flex justify-center items-center bg-slate-50">
      <div className="animate-pulse text-slate-500">Redirecting...</div>
    </div>
  );
}