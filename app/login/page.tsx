'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';
import { completeLoginWithOptionalNativeHandoff } from '@/lib/hanarAppAuthRedirect';
import { flushPendingNativePushToken } from '@/components/FcmTokenHandler';
import { resolvePostLoginHref, type PostLoginUserType } from '@/lib/postLoginNavigation';

const PROFILE_LOOKUP_TIMEOUT_MS = 8000;

async function fetchAccountType(userId: string): Promise<PostLoginUserType> {
  try {
    const lookup = supabase
      .from('registeredaccounts')
      .select('business, organization')
      .eq('user_id', userId)
      .maybeSingle();

    const profile = await Promise.race([
      lookup.then((res) => res.data),
      new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), PROFILE_LOOKUP_TIMEOUT_MS);
      }),
    ]);

    if (profile?.business === true) return 'business';
    if (profile?.organization === true) return 'organization';
  } catch {
    /* default individual */
  }
  return 'individual';
}

export default function LoginPage() {
  const { effectiveLang } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clicked, setClicked] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const submitLockRef = useRef(false);
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  const persistUserTypeAndNavigate = useCallback(
    async (
      session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>,
      options?: { showSuccessToast?: boolean },
    ) => {
      const userType = await fetchAccountType(session.user.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('userType', userType);
      }
      void flushPendingNativePushToken(session);

      const href = resolvePostLoginHref(redirectParam, userType);
      if (options?.showSuccessToast) {
        toast.success(t(effectiveLang, 'Login successful!'));
      }
      await completeLoginWithOptionalNativeHandoff(session, href);
    },
    [effectiveLang, redirectParam],
  );

  useEffect(() => {
    const redirectIfLoggedIn = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) return;
        await persistUserTypeAndNavigate(session);
      } finally {
        setCheckingAuth(false);
      }
    };
    void redirectIfLoggedIn();
  }, [persistUserTypeAndNavigate]);

  useEffect(() => {
    if (checkingAuth) return;
    const syncAutofill = () => {
      const emailEl = document.getElementById('email') as HTMLInputElement | null;
      const passwordEl = document.getElementById('password') as HTMLInputElement | null;
      if (emailEl?.value) setEmail((prev) => prev || emailEl.value);
      if (passwordEl?.value) setPassword((prev) => prev || passwordEl.value);
    };
    syncAutofill();
    const t1 = window.setTimeout(syncAutofill, 100);
    const t2 = window.setTimeout(syncAutofill, 400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [checkingAuth]);

  const resetSubmitState = () => {
    submitLockRef.current = false;
    setClicked(false);
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setClicked(true);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const emailFromForm = String(fd.get('email') ?? '').trim();
    const passwordFromForm = String(fd.get('password') ?? '');

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailFromForm || email.trim(),
        password: passwordFromForm || password,
      });

      if (signInError) {
        toast.error(signInError.message);
        resetSubmitState();
        return;
      }

      const session = signInData.session;
      if (!session?.user?.id) {
        toast.error(t(effectiveLang, 'Login succeeded, but user ID is missing.'));
        resetSubmitState();
        return;
      }

      await persistUserTypeAndNavigate(session, { showSuccessToast: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t(effectiveLang, 'Unexpected login error.');
      toast.error(message);
      resetSubmitState();
    } finally {
      window.setTimeout(() => {
        if (window.location.pathname.startsWith('/login')) {
          resetSubmitState();
        }
      }, 15000);
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
