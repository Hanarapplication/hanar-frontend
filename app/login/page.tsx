'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clicked, setClicked] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setClicked(true);
    setError('');

    try {
      const res = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setClicked(false);
        return;
      }

      // ✅ Save token
      localStorage.setItem('hanarToken', data.token);

      // ✅ Optional: redirect to dashboard or home
      router.push('/dashboard'); // Change this path if needed
    } catch (err) {
      setError('Network error. Please try again.');
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
            <div className="mt-2 text-right">
              <a href="/forgot-password" className="text-sm text-blue-600 hover:underline">
                Forgot password?
              </a>
            </div>
          </div>

          {error && (
            <p className="text-red-600 text-sm text-center font-medium">{error}</p>
          )}

          <button
            type="submit"
            className={`w-full py-2 rounded-md text-white font-semibold transition-transform duration-300 transform ${
              clicked ? 'scale-95 bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
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
