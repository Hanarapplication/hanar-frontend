'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

export default function ForgotPasswordPage() {
  const { effectiveLang } = useLanguage();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const redirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/reset-password`
        : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectTo || undefined,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setSent(true);
      toast.success(t(effectiveLang, 'Check your email for the reset link.'));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t(effectiveLang, 'Something went wrong.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-300 px-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl">
        <h1 className="text-2xl font-bold text-center text-blue-600 mb-4">
          {t(effectiveLang, 'Forgot Password')}
        </h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          {t(effectiveLang, "Forgot password subtitle")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              {t(effectiveLang, 'Email address')}
            </label>
            <input
              type="email"
              id="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t(effectiveLang, 'you@example.com')}
              className="mt-1 w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t(effectiveLang, 'Sending...') : t(effectiveLang, 'Send Reset Link')}
          </button>
        </form>

        {sent && (
          <p className="text-green-600 text-center mt-4 text-sm">
            {t(effectiveLang, "If an account exists for this email, you will receive a link to set a new password.")}
          </p>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          <a href="/login" className="text-blue-600 hover:underline">
            {t(effectiveLang, 'Back to Login')}
          </a>
        </p>
      </div>
    </div>
  );
}
