'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAdminSession = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user || !user.email) {
        console.warn('🔒 Not logged in or email missing');
        router.push('/admin-login');
        return;
      }

      try {
        const response = await fetch('/api/check-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email.toLowerCase() }), // ✅ send correct email
        });

        const result = await response.json();

        if (response.ok && result.allowed) {
          console.log('✅ Logged in as:', result.role);
          setAuthorized(true);
        } else {
          console.warn('🚫 Access denied:', result.message);
          router.push('/unauthorized');
        }
      } catch (e) {
        console.error('❌ API error:', e);
        router.push('/unauthorized');
      } finally {
        setChecking(false);
      }
    };

    checkAdminSession();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-700 text-lg">
        🔒 Checking admin access...
      </div>
    );
  }

  return authorized ? <div>{children}</div> : null;
}
