'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [role, setRole] = useState<'individual' | 'business' | 'organization'>('individual');
  const [clicked, setClicked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    businessName: '',
    organizationName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreed) return toast.error('You must agree to the Terms and Privacy Policy.');
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match.');
    if (!strongPassword(form.password)) {
      return toast.error('Password must include uppercase, number, special character & 8+ chars.');
    }

    const name =
      role === 'business'
        ? form.businessName
        : role === 'organization'
        ? form.organizationName
        : form.fullName;

    try {
      setClicked(true);

      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          role,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        console.error('Registration failed:', data);
        return toast.error(data?.error || 'Registration failed. Try again.');
      }

      toast.success(`Welcome, @${data.username || name}!`);

      if (data.role === 'business') {
        router.push('/business/onboard');
      } else if (data.role === 'organization') {
        router.push('/organization/dashboard');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.message || 'Unexpected error');
    } finally {
      setClicked(false);
    }
  };

  const strongPassword = (pass: string) => {
    return (
      pass.length >= 8 && /[A-Z]/.test(pass) && /[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 space-y-6">
        <h2 className="text-3xl font-semibold text-center text-gray-800">Create Your Hanar Account</h2>

        <form className="space-y-4" onSubmit={handleRegister}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Register As:</label>
            <div className="flex gap-4">
              <label><input type="radio" value="individual" checked={role === 'individual'} onChange={() => setRole('individual')} /> Individual</label>
              <label><input type="radio" value="business" checked={role === 'business'} onChange={() => setRole('business')} /> Business</label>
              <label><input type="radio" value="organization" checked={role === 'organization'} onChange={() => setRole('organization')} /> Organization</label>
            </div>
          </div>

          {role === 'individual' && (
            <input
              id="fullName"
              type="text"
              required
              placeholder="Full Name"
              value={form.fullName}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          )}

          {role === 'business' && (
            <>
              <input
                id="fullName"
                type="text"
                required
                placeholder="Your Name (Owner)"
                value={form.fullName}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
              <input
                id="businessName"
                type="text"
                required
                placeholder="Business Name"
                value={form.businessName}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </>
          )}

          {role === 'organization' && (
            <>
              <input
                id="fullName"
                type="text"
                required
                placeholder="Your Name (Representative)"
                value={form.fullName}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
              <input
                id="organizationName"
                type="text"
                required
                placeholder="Organization Name"
                value={form.organizationName}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </>
          )}

          <input
            id="email"
            type="email"
            required
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />

          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            required
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
          <input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            required
            placeholder="Confirm Password"
            value={form.confirmPassword}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />

          <label className="flex items-start space-x-2 text-sm">
            <input
              id="agreed"
              type="checkbox"
              className="mt-1"
              checked={agreed}
              onChange={() => setAgreed(!agreed)}
            />
            <span className="text-gray-700">
              I agree to the{' '}
              <a href="/terms" className="text-indigo-600 hover:underline">Terms</a> and{' '}
              <a href="/privacy" className="text-indigo-600 hover:underline">Privacy Policy</a>
            </span>
          </label>

          <button
            type="submit"
            disabled={clicked}
            className={`w-full py-2 px-4 text-white font-medium rounded-md ${clicked ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {clicked ? 'Registering...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
