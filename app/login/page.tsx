'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

export default function LoginPage() {
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
        toast.error('Login succeeded, but user ID is missing.');
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
        toast.error(`Failed to load account type: ${profileError.message}`);
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
      toast.success('Login successful!');
      router.replace('/');
    } catch (err: any) {
      toast.error(err?.message || 'Unexpected login error.');
    } finally {
      setClicked(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-300 px-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl">
        <h1 className="text-3xl font-bold text-center text-blue-600 mb-6">
          Welcome to Hanar
        </h1>

        <form className="space-y-5" onSubmit={handleLogin}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="mt-1 w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="mt-1 w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <button
            type="submit"
            className={`w-full py-2 rounded-md text-white font-semibold transition-transform duration-300 transform ${
              clicked ? 'scale-95 bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
            disabled={clicked}
          >
            {clicked ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Don’t have an account?{' '}
          <a href="/register" className="text-blue-600 hover:underline">
            Register
          </a>
        </p>
      </div>
    </div>
  );
}
