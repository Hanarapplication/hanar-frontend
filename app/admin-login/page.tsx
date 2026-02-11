'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';

const LOCKOUT_KEY = 'admin_login_failures';
const LOCKOUT_UNTIL_KEY = 'admin_login_lockout_until';
const MAX_FAILURES = 5;
const LOCKOUT_MINUTES = 30;

function getStoredFailures(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = sessionStorage.getItem(LOCKOUT_KEY);
    return raw ? Math.max(0, parseInt(raw, 10)) : 0;
  } catch {
    return 0;
  }
}

function getLockoutUntil(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = sessionStorage.getItem(LOCKOUT_UNTIL_KEY);
    return raw ? Math.max(0, parseInt(raw, 10)) : 0;
  } catch {
    return 0;
  }
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState(0);
  const router = useRouter();

  useEffect(() => {
    setLockoutUntil(getLockoutUntil());
    const interval = setInterval(() => {
      const until = getLockoutUntil();
      setLockoutUntil(until);
      if (until > 0 && Date.now() >= until) {
        sessionStorage.removeItem(LOCKOUT_KEY);
        sessionStorage.removeItem(LOCKOUT_UNTIL_KEY);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lockoutUntil > Date.now()) {
      toast.error('Too many failed attempts. Try again later.');
      return;
    }

    setLoading(true);
    try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError || !authData.user) {
      const failures = getStoredFailures() + 1;
      sessionStorage.setItem(LOCKOUT_KEY, String(failures));
      if (failures >= MAX_FAILURES) {
        const until = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
        sessionStorage.setItem(LOCKOUT_UNTIL_KEY, String(until));
        setLockoutUntil(until);
        toast.error(`Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`);
      } else {
        toast.error('Invalid credentials or access denied.');
      }
      setLoading(false);
      return;
    }

    // Clear failure count on success
    sessionStorage.removeItem(LOCKOUT_KEY);
    sessionStorage.removeItem(LOCKOUT_UNTIL_KEY);

    const token = authData.session?.access_token;
    if (!token) {
      toast.error('Invalid credentials or access denied.');
      setLoading(false);
      return;
    }

    const response = await fetch('/api/check-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    const result = await response.json();

    if (!response.ok || !result.allowed) {
      toast.error(result.message || 'Invalid credentials or access denied.');
      setLoading(false);
      return;
    }

    const role = result.role;
    toast.success('Logged in successfully.');

    Cookies.set('adminRole', role, {
      path: '/',
      sameSite: 'strict',
      expires: 8 / 24,
    });

    setLoading(false);
    const target =
      role === 'owner' || role === 'ceo' || role === 'topmanager'
        ? '/admin/owner'
        : role === 'reviewer'
          ? '/admin/approvals'
          : role === 'moderator'
            ? '/admin/community-moderation'
            : '/admin/dashboard';

    await new Promise((r) => setTimeout(r, 100));
    router.replace(target);
    } finally {
      setLoading(false);
    }
  };

  const isLockedOut = lockoutUntil > Date.now();
  const lockoutMinutesLeft = isLockedOut
    ? Math.ceil((lockoutUntil - Date.now()) / 60000)
    : 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fef6f3] px-4">
      <form
        onSubmit={handleLogin}
        className="bg-white shadow-xl rounded-xl p-8 w-full max-w-md space-y-6"
        autoComplete="off"
      >
        <h1 className="text-2xl font-bold text-center text-gray-800">Admin Login</h1>

        {isLockedOut && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 text-center">
            Too many failed attempts. Try again in {lockoutMinutesLeft} minute{lockoutMinutesLeft !== 1 ? 's' : ''}.
          </div>
        )}

        <input
          type="email"
          placeholder="Admin email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="off"
          className="w-full border border-gray-300 rounded-lg px-4 py-2"
          disabled={isLockedOut}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="off"
          className="w-full border border-gray-300 rounded-lg px-4 py-2"
          disabled={isLockedOut}
        />

        <button
          type="submit"
          disabled={loading || isLockedOut}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
