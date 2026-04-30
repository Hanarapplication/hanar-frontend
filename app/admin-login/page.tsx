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
  const [securityCode, setSecurityCode] = useState('');
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
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

    setLoading(true);
    try {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error('Email is required.');
      setLoading(false);
      return;
    }
    const lockoutStatusRes = await fetch(`/api/admin/auth/lockout?email=${encodeURIComponent(normalizedEmail)}`);
    if (lockoutStatusRes.ok) {
      const lockoutStatus = await lockoutStatusRes.json();
      const until = lockoutStatus?.lockoutUntil ? new Date(lockoutStatus.lockoutUntil).getTime() : 0;
      setLockoutUntil(until);
      if (lockoutStatus?.locked && until > Date.now()) {
        toast.error('Too many failed attempts. Try again later.');
        setLoading(false);
        return;
      }
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (authError || !authData.user) {
      const failureRes = await fetch('/api/admin/auth/lockout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, success: false }),
      });
      const failure = failureRes.ok ? await failureRes.json() : null;
      const until = failure?.lockoutUntil ? new Date(failure.lockoutUntil).getTime() : 0;
      if (until > 0) setLockoutUntil(until);
      if (failure?.locked) toast.error(`Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`);
      else toast.error('Invalid credentials or access denied.');
      setLoading(false);
      return;
    }

    await fetch('/api/admin/auth/lockout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, success: true }),
    });
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

    if (!response.ok && result?.pinOnHold) {
      toast.error(result.message || 'Account is on hold. Contact owner.');
      setLoading(false);
      return;
    }

    if (!response.ok && result?.requiresPin) {
      setPendingToken(token);
      setPendingRole(result?.role || null);
      toast('Enter your 4-digit admin security code.');
      setLoading(false);
      return;
    }

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
            : role === 'business'
              ? '/admin/dashboard'
              : '/admin/dashboard';

    await new Promise((r) => setTimeout(r, 100));
    router.replace(target);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySecurityCode = async () => {
    if (!pendingToken) return;
    const code = securityCode.replace(/\s+/g, '').trim();
    if (!/^\d{4}$/.test(code)) {
      toast.error('Enter a valid 4-digit code.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/pin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pendingToken}`,
        },
        body: JSON.stringify({ pin: code }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Invalid verification code.');
        return;
      }
      const role = String(data.role || pendingRole || '');
      Cookies.set('adminRole', role, {
        path: '/',
        sameSite: 'strict',
        expires: 8 / 24,
      });
      toast.success('Security code verified.');
      setPendingToken(null);
      setSecurityCode('');
      const target =
        role === 'owner' || role === 'ceo' || role === 'topmanager'
          ? '/admin/owner'
          : role === 'reviewer'
            ? '/admin/approvals'
            : role === 'moderator'
              ? '/admin/community-moderation'
              : '/admin/dashboard';
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

        {!pendingToken ? (
          <>
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
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="off"
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
              disabled={isLockedOut}
            />

            <div className="flex items-center gap-2">
              <input
                id="admin-login-show-password"
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                disabled={isLockedOut}
              />
              <label htmlFor="admin-login-show-password" className="text-sm text-gray-700 cursor-pointer">
                Show password
              </label>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2 text-sm text-indigo-700">
              Enter your owner-assigned 4-digit admin security code.
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="1234"
              value={securityCode}
              onChange={(e) => setSecurityCode(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 tracking-[0.35em] text-center text-lg"
              disabled={loading}
            />
          </div>
        )}

        {!pendingToken ? (
          <button
            type="submit"
            disabled={loading || isLockedOut}
            className="w-full bg-rose-600 text-white py-2 rounded-lg hover:bg-rose-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPendingToken(null);
                setSecurityCode('');
              }}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition"
              disabled={loading}
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleVerifySecurityCode}
              disabled={loading}
              className="flex-1 bg-rose-600 text-white py-2 rounded-lg hover:bg-rose-700 transition disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify code'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
