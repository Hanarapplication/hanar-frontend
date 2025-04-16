'use client';

import { useState } from 'react';

export default function RegisterPage() {
  const [clicked, setClicked] = useState(false);
  const [error, setError] = useState('');
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

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreed) {
      setError('You must agree to the Terms and Privacy Policy.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isStrongPassword(form.password)) {
      setError(
        'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
      );
      return;
    }

    setError('');
    setClicked(true);
    setTimeout(() => setClicked(false), 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-300 px-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl">
        <h1 className="text-3xl font-bold text-center text-blue-600 mb-6">
          Create Your Hanar Account
        </h1>

        <form className="space-y-5" onSubmit={handleRegister}>
          {/* Full Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              required
              placeholder="John Doe"
              value={form.name}
              onChange={handleChange}
              className="mt-1 w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              type="email"
              id="email"
              required
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              className="mt-1 w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              required
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              className="mt-1 w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            {/* Strength Meter */}
            {form.password && (
              <div className="mt-2">
                <div className="w-full h-2 rounded bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      {
                        1: 'w-1/4 bg-red-500',
                        2: 'w-2/4 bg-orange-400',
                        3: 'w-3/4 bg-yellow-400',
                        4: 'w-full bg-green-500',
                      }[getStrengthScore(form.password)] || 'w-0'
                    }`}
                  />
                </div>
                <p className="text-xs mt-1 text-gray-600">
                  Strength:{' '}
                  {{
                    1: 'Weak',
                    2: 'Okay',
                    3: 'Strong',
                    4: 'Very Strong',
                  }[getStrengthScore(form.password)] || 'Too Short'}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="confirmPassword"
              required
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={handleChange}
              className="mt-1 w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Show Password */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="showPassword"
              checked={showPassword}
              onChange={() => setShowPassword(!showPassword)}
              className="mr-2"
            />
            <label htmlFor="showPassword" className="text-sm text-gray-700">
              Show password
            </label>
          </div>

          {/* Terms & Privacy */}
          <div className="flex items-start">
            <input
              type="checkbox"
              id="agreed"
              checked={agreed}
              onChange={() => setAgreed(!agreed)}
              className="mt-1 mr-2"
            />
            <label htmlFor="agreed" className="text-sm text-gray-700">
              I agree to the{' '}
              <a href="/terms" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-red-600 text-sm text-center">{error}</p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={clicked}
            className={`w-full py-2 rounded-md text-white font-semibold transition-transform duration-300 transform ${
              clicked ? 'scale-95 bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {clicked ? 'Registering...' : 'Register'}
          </button>
        </form>

        {/* Already have account */}
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
