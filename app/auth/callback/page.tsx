'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import {
  completeLoginWithOptionalNativeHandoff,
  syncHanarAppIntentFromBrowser,
} from '@/lib/hanarAppAuthRedirect';
import { flushPendingNativePushToken } from '@/components/FcmTokenHandler';
import { resolvePostLoginHref, type PostLoginUserType } from '@/lib/postLoginNavigation';

export default function AuthCallback() {
  useEffect(() => {
    const handleRedirect = async () => {
      syncHanarAppIntentFromBrowser();

      const { data, error } = await supabase.auth.getSession();

      if (error || !data?.session) {
        toast.error('Login failed. Please try again.');
        window.location.assign('/login');
        return;
      }

      const session = data.session;
      await flushPendingNativePushToken(session);

      const userId = session.user?.id;
      let userType: PostLoginUserType = 'individual';
      if (userId) {
        const { data: profile } = await supabase
          .from('registeredaccounts')
          .select('business, organization')
          .eq('user_id', userId)
          .maybeSingle();

        if (profile?.business === true) {
          userType = 'business';
        } else if (profile?.organization === true) {
          userType = 'organization';
        }

        if (typeof window !== 'undefined') {
          localStorage.setItem('userType', userType);
        }
      }

      const href = resolvePostLoginHref(null, userType);
      await completeLoginWithOptionalNativeHandoff(session, href);
    };

    void handleRedirect();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-lg text-gray-700">Signing you in...</p>
    </div>
  );
}
