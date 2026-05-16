'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';
import {
  hasHanarAppLoginIntent,
  redirectToHanarAppWithSession,
} from '@/lib/hanarAppAuthRedirect';
import { flushPendingNativePushToken } from '@/components/FcmTokenHandler';
import { resolvePostLoginHref, type PostLoginUserType } from '@/lib/postLoginNavigation';

export default function LoginPage() {
  const { effectiveLang } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clicked, setClicked] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const submitLockRef = useRef(false);
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  useEffect(() => {
    const redirectIfLoggedIn = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setCheckingAuth(false);
        return;
      }
      await flushPendingNativePushToken(session);
      if (typeof window !== 'undefined' && session && hasHanarAppLoginIntent()) {
        redirectToHanarAppWithSession(session);
        return;
      }
      const { data: profile } = await supabase
        .from('registeredaccounts')
        .select('business, organization')
        .eq('user_id', user.id)
        .maybeSingle();

      let userType: PostLoginUserType = 'individual';
      if (profile?.business === true) {
        userType = 'business';
      } else if (profile?.organization === true) {
        userType = 'organization';
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('userType', userType);
      }
      const href = resolvePostLoginHref(redirectParam, userType);
      window.location.assign(href);
    };
    redirectIfLoggedIn();
  }, [redirectParam]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setClicked(true);

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        toast.error(signInError.message);
        return;
      }

      const userId = signInData.user?.id;
      if (!userId) {
        toast.error(t(effectiveLang, 'Login succeeded, but user ID is missing.'));
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('registeredaccounts')
        .select('business, organization')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        toast.error(`${t(effectiveLang, 'Failed to load account type:')} ${profileError.message}`);
        return;
      }

      let userType: PostLoginUserType = 'individual';
      if (profile?.business === true) {
        userType = 'business';
      } else if (profile?.organization === true) {
        userType = 'organization';
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('userType', userType);
      }

      const session = signInData.session;
      await flushPendingNativePushToken(session ?? null);

      if (typeof window !== 'undefined' && session && hasHanarAppLoginIntent()) {
        redirectToHanarAppWithSession(session);
        return;
      }

      toast.success(t(effectiveLang, 'Login successful!'));
      const href = resolvePostLoginHref(redirectParam, userType);
      window.location.assign(href);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t(effectiveLang, 'Unexpected login error.');
      toast.error(message);
    } finally {
      submitLockRef.current = false;
      setClicked(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] px-4">
        <div className="text-gray-500">{t(effectiveLang, 'Loading...')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] px-4">
      <div className="relative z-20 pointer-events-auto bg-white w-full max-w-md p-6 rounded-lg shadow-[0_2px_4px_rgba(0,0,0,.1),0_8px_16px_rgba(0,0,0,.1)]">
        <div className="flex justify-center mb-6">
          <img
            src="/hanar.logo.png"
            alt="Hanar"
            width={160}
            height={100}
            className="h-16 w-auto max-w-[min(100%,14rem)] object-contain"
            decoding="async"
          />
        </div>

        <form onSubmit={handleLogin} className="space-y-4 pointer-events-auto" autoComplete="on">
          <input
            type="email"
            id="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder={t(effectiveLang, 'Email or phone number')}
            className="relative z-10 pointer-events-auto w-full px-4 py-3 text-base border border-gray-300 rounded-lg placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#1877F2] focus:border-[#1877F2]"
          />
          <input
            type="password"
            id="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder={t(effectiveLang, 'Password')}
            className="relative z-10 pointer-events-auto w-full px-4 py-3 text-base border border-gray-300 rounded-lg placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#1877F2] focus:border-[#1877F2]"
          />

          <button
            type="submit"
            disabled={clicked}
            className="w-full py-3 rounded-lg text-white font-semibold text-lg bg-[#1877F2] hover:bg-[#166fe5] disabled:opacity-70 transition"
          >
            {clicked ? t(effectiveLang, 'Logging in...') : t(effectiveLang, 'Log In')}
          </button>
          <a
            href="/forgot-password"
            className="block text-center text-sm text-[#1877F2] hover:underline"
          >
            {t(effectiveLang, 'Forgotten password?')}
          </a>
        </form>

        <hr className="my-6 border-gray-200" />

        <a
          href="/register"
          className="block w-full py-3 text-center rounded-lg font-semibold text-white bg-indigo-500 hover:bg-indigo-600 transition"
        >
          {t(effectiveLang, 'Create new account')}
        </a>

        <Link
          href="/"
          className="mt-3 block w-full py-2.5 text-center rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
        >
          {t(effectiveLang, 'View without logging in')}
        </Link>

        <p className="mt-4 text-center text-xs text-gray-500 leading-relaxed">
          <span>{t(effectiveLang, 'Login legal prefix')}</span>
          <Link
            href="/terms"
            className="font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-800 dark:text-indigo-400"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t(effectiveLang, 'Terms of Service')}
          </Link>
          <span>{t(effectiveLang, 'Login legal between')}</span>
          <Link
            href="/privacy"
            className="font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-800 dark:text-indigo-400"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t(effectiveLang, 'Privacy Policy')}
          </Link>
          <span>{t(effectiveLang, 'Login legal suffix')}</span>
        </p>
      </div>
    </div>
  );
}
