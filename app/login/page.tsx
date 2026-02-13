'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

export default function LoginPage() {
  const { effectiveLang } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clicked, setClicked] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clicked) return;

    setClicked(true);

    try {
      // ✅ 1) Sign in
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

      // ✅ 2) Get account type from your table
      // NOTE: make sure `registeredaccounts.user_id` is the auth user id (uuid)
      const { data: profile, error: profileError } = await supabase
        .from('registeredaccounts')
        .select('business, organization')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        toast.error(`${t(effectiveLang, 'Failed to load account type:')} ${profileError.message}`);
        return;
      }

      // ✅ 3) Determine user type and store it
      let userType: 'business' | 'individual' | 'organization' = 'individual';
      
      if (profile?.business === true) {
        userType = 'business';
      } else if (profile?.organization === true) {
        userType = 'organization';
      }

      // Store user type in localStorage so it's available throughout the app
      if (typeof window !== 'undefined') {
        localStorage.setItem('userType', userType);
      }

      // ✅ 4) Redirect everyone to home page
      toast.success(t(effectiveLang, 'Login successful!'));
      router.replace('/');
    } catch (err: any) {
      toast.error(err?.message || t(effectiveLang, 'Unexpected login error.'));
    } finally {
      setClicked(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] px-4">
      <div className="bg-white w-full max-w-md p-6 rounded-lg shadow-[0_2px_4px_rgba(0,0,0,.1),0_8px_16px_rgba(0,0,0,.1)]">
        <div className="flex justify-center mb-6">
          <Image
            src="/hanar.logo.png"
            alt="Hanar"
            width={100}
            height={64}
            className="h-16 w-auto object-contain"
            unoptimized
            priority
          />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder={t(effectiveLang, 'Email or phone number')}
            className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#1877F2] focus:border-[#1877F2]"
          />
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder={t(effectiveLang, 'Password')}
            className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#1877F2] focus:border-[#1877F2]"
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

        <p className="mt-4 text-center text-xs text-gray-500">
          {t(effectiveLang, 'By continuing, you agree to our Terms and Privacy Policy.')}
        </p>
      </div>
    </div>
  );
}
