'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Step 1: Sign in with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      toast.error('Login failed. Check credentials.');
      setLoading(false);
      return;
    }

    const { user } = authData;

    // Step 2: Check admin status & get role
    const response = await fetch('/api/check-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    });

    const result = await response.json();

    if (!response.ok || !result.allowed) {
      toast.error(result.message || 'Access denied: Not an admin');
      setLoading(false);
      return;
    }

    const role = result.role;
    toast.success('Logged in as ' + role);

    // ✅ Step 3: Set adminRole cookie for middleware
    Cookies.set('adminRole', role);

    // ✅ Step 4: Redirect based on role
    switch (role) {
      case 'owner':
      case 'ceo':
      case 'topmanager':
        router.push('/admin/owner');
        break;
      case 'manager':
        router.push('/admin/overview');
        break;
      case 'reviewer':
        router.push('/admin/approvals');
        break;
      case 'support':
        router.push('/admin/support');
        break;
      case 'moderator':
        router.push('/admin/community');
        break;
      case 'editor':
        router.push('/admin/content');
        break;
      case 'readonly':
        router.push('/admin/viewer');
        break;
      default:
        router.push('/unauthorized');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fef6f3] px-4">
      <form
        onSubmit={handleLogin}
        className="bg-white shadow-xl rounded-xl p-8 w-full max-w-md space-y-6"
      >
        <h1 className="text-2xl font-bold text-center text-gray-800">🛡️ Admin Login</h1>

        <input
          type="email"
          placeholder="Admin Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-4 py-2"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-4 py-2"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
        >
          {loading ? 'Logging in...' : 'Login as Admin'}
        </button>
      </form>
    </div>
  );
}
