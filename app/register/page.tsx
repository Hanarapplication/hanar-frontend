'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [clicked, setClicked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const getStrengthScore = (password: string) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const isStrongPassword = (password: string) => getStrengthScore(password) === 4;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreed) {
      toast.error('You must agree to the Terms and Privacy Policy.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    if (!isStrongPassword(form.password)) {
      toast.error('Password must include uppercase, lowercase, number & special char.');
      return;
    }

    try {
      setClicked(true);
      const res = await fetch('http://localhost:5000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      localStorage.setItem('hanarToken', data.token);
      toast.success('Registration successful! Redirecting...');
      window.location.href = '/dashboard';
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setClicked(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-300 px-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl">
        <h1 className="text-3xl font-bold text-center text-blue-600 mb-6">
          Create Your Hanar Account
        </h1>

        <form className="space-y-5" onSubmit={handleRegister}>
          <input
            type="text"
            id="name"
            placeholder="Full Name"
            required
            value={form.name}
            onChange={handleChange}
            className="w-full border px-4 py-2 rounded"
          />
          <input
            type="email"
            id="email"
            placeholder="Email"
            required
            value={form.email}
            onChange={handleChange}
            className="w-full border px-4 py-2 rounded"
          />
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            placeholder="Password"
            required
            value={form.password}
            onChange={handleChange}
            className="w-full border px-4 py-2 rounded"
          />
          <input
            type={showPassword ? 'text' : 'password'}
            id="confirmPassword"
            placeholder="Confirm Password"
            required
            value={form.confirmPassword}
            onChange={handleChange}
            className="w-full border px-4 py-2 rounded"
          />

          {/* Password Strength Bar */}
          {form.password && (
            <div className="mt-1">
              <div className="w-full h-2 rounded bg-gray-200">
                <div
                  className={`h-full transition-all ${
                    {
                      1: 'w-1/4 bg-red-500',
                      2: 'w-2/4 bg-orange-400',
                      3: 'w-3/4 bg-yellow-400',
                      4: 'w-full bg-green-500',
                    }[getStrengthScore(form.password)] || 'w-0'
                  }`}
                />
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Strength: {
                  {
                    1: 'Weak',
                    2: 'Moderate',
                    3: 'Strong',
                    4: 'Very Strong',
                  }[getStrengthScore(form.password)] || 'Too short'
                }
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showPassword"
              checked={showPassword}
              onChange={() => setShowPassword(!showPassword)}
            />
            <label htmlFor="showPassword" className="text-sm">
              Show password
            </label>
          </div>

          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="agreed"
              checked={agreed}
              onChange={() => setAgreed(!agreed)}
              className="mt-1"
            />
            <label htmlFor="agreed" className="text-sm text-gray-700">
              I agree to the{' '}
              <a href="/terms" target="_blank" className="text-blue-600 underline">
                Terms
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" className="text-blue-600 underline">
                Privacy Policy
              </a>
            </label>
          </div>

          <button
            type="submit"
            disabled={clicked}
            className={`w-full py-2 text-white rounded-md font-semibold ${
              clicked ? 'bg-blue-700 scale-95' : 'bg-blue-600 hover:bg-blue-700'
            } transition-transform duration-300`}
          >
            {clicked ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <a href="/login" className="text-blue-600 hover:underline">
            Login
          </a>
        </p>
      </div>
    </div>
  );
}
