'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Turnstile } from '@marsidev/react-turnstile';
import {
  User,
  Building2,
  Landmark,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';

// Simple toast (replace later with react-hot-toast if you want)
const toast = {
  error: (msg: string) => console.error(msg),
  success: (msg: string) => console.log(msg),
};

type Role = 'individual' | 'business' | 'organization';

/* ---------------- Role Option ---------------- */

const RoleOption = ({
  value,
  label,
  desc,
  icon: Icon,
  currentRole,
  setRole,
}: {
  value: Role;
  label: string;
  desc: string;
  icon: any;
  currentRole: Role;
  setRole: (role: Role) => void;
}) => {
  const active = currentRole === value;

  return (
    <label
      className={`relative flex cursor-pointer flex-col items-center rounded-2xl border-2 p-4 text-center transition-all
        ${active
          ? 'border-indigo-600 bg-indigo-50/50 shadow-md'
          : 'border-slate-100 bg-white hover:border-indigo-200'
        }`}
    >
      <input
        type="radio"
        name="role"
        value={value}
        checked={active}
        onChange={() => setRole(value)}
        className="sr-only"
      />
      <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
        <Icon size={22} />
      </div>
      <span className="text-sm font-semibold">{label}</span>
      <span className="mt-1 text-[11px] text-slate-500">{desc}</span>
      {active && <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-indigo-600" />}
    </label>
  );
};

/* ---------------- Floating Input ---------------- */

const FloatingInput = ({
  id,
  placeholder,
  value,
  onChange,
  disabled,
  type = 'text',
  isPassword,
  showPassword,
  setShowPassword,
  error,
}: any) => {
  const hasValue = value?.length > 0;

  return (
    <div className="relative w-full">
      <input
        id={id}
        type={isPassword ? (showPassword ? 'text' : 'password') : type}
        placeholder=" "
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`peer w-full rounded-xl border px-4 pt-6 pb-2 text-sm outline-none
          ${error ? 'border-red-400' : 'border-slate-200 focus:border-indigo-600'}
        `}
      />
      <label
        htmlFor={id}
        className={`absolute left-4 transition-all
          ${hasValue ? 'top-3 text-xs font-semibold text-indigo-600' : 'top-1/2 -translate-y-1/2 text-sm text-slate-400 peer-focus:top-3 peer-focus:text-xs peer-focus:text-indigo-600'}
        `}
      >
        {placeholder}
      </label>

      {isPassword && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-6 text-slate-400"
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      )}

      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
};

/* ---------------- Main Page ---------------- */

export default function RegisterPage() {
  const router = useRouter();

  const [role, setRole] = useState<Role>('individual');
  const [clicked, setClicked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    businessName: '',
    organizationName: '',
    email: '',
    password: '',
    confirmPassword: '',
    website: '', // honeypot - bots fill this
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [e.target.id]: e.target.value }));
  };

  /* ---------- Validation ---------- */

  const passwordMatch = form.password === form.confirmPassword;

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (form.password.length >= 8) score++;
    if (/[A-Z]/.test(form.password)) score++;
    if (/[0-9]/.test(form.password)) score++;
    if (/[^A-Za-z0-9]/.test(form.password)) score++;
    return score;
  }, [form.password]);

  const name =
    role === 'business'
      ? form.businessName
      : role === 'organization'
      ? form.organizationName
      : form.fullName;

  /* ---------- Submit ---------- */

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || name.length < 3) return toast.error('Name too short');
    if (!passwordMatch) return toast.error('Passwords do not match');
    if (passwordStrength < 3) return toast.error('Password too weak');
    if (!agreed) return toast.error('Accept Terms');
    if (!turnstileToken) return toast.error('Please complete the verification');

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
          turnstileToken,
          website: form.website,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      toast.success('Account created. Please log in.');
      router.push('/login'); // ✅ REDIRECT HERE

    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setClicked(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form onSubmit={handleRegister} className="w-full max-w-xl bg-white rounded-3xl p-10 space-y-8 shadow-xl">
        <h1 className="text-3xl font-bold text-center">Create Account</h1>

        <div className="grid grid-cols-3 gap-3">
          <RoleOption value="individual" label="Individual" desc="Personal use" icon={User} currentRole={role} setRole={setRole} />
          <RoleOption value="business" label="Business" desc="Sell & promote" icon={Building2} currentRole={role} setRole={setRole} />
          <RoleOption value="organization" label="Org" desc="Community" icon={Landmark} currentRole={role} setRole={setRole} />
        </div>

        {role === 'individual' && (
          <FloatingInput id="fullName" placeholder="Full Name" value={form.fullName} onChange={handleChange} disabled={clicked} />
        )}

        {role === 'business' && (
          <>
            <FloatingInput id="fullName" placeholder="Owner Name" value={form.fullName} onChange={handleChange} disabled={clicked} />
            <FloatingInput id="businessName" placeholder="Business Name" value={form.businessName} onChange={handleChange} disabled={clicked} />
          </>
        )}

        {role === 'organization' && (
          <>
            <FloatingInput id="fullName" placeholder="Representative Name" value={form.fullName} onChange={handleChange} disabled={clicked} />
            <FloatingInput id="organizationName" placeholder="Organization Name" value={form.organizationName} onChange={handleChange} disabled={clicked} />
          </>
        )}

        <FloatingInput id="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} disabled={clicked} />
        <FloatingInput id="password" placeholder="Password" isPassword showPassword={showPassword} setShowPassword={setShowPassword} value={form.password} onChange={handleChange} disabled={clicked} />
        <FloatingInput id="confirmPassword" placeholder="Confirm Password" isPassword showPassword={showPassword} setShowPassword={setShowPassword} value={form.confirmPassword} onChange={handleChange} disabled={clicked} error={!passwordMatch ? 'Passwords do not match' : null} />

        <div className="sr-only" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input id="website" type="text" value={form.website} onChange={handleChange} tabIndex={-1} autoComplete="off" />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={agreed} onChange={() => setAgreed(!agreed)} />
          I agree to the Terms & Privacy Policy
        </label>

        <div className="flex justify-center">
          <Turnstile
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA'}
            onSuccess={(token) => setTurnstileToken(token)}
            onExpire={() => setTurnstileToken(null)}
            options={{
              theme: 'light',
              size: 'normal',
            }}
          />
        </div>

        <button
          disabled={clicked}
          className={`w-full rounded-xl py-3 font-bold text-white ${clicked ? 'bg-slate-300' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          {clicked ? <Loader2 className="animate-spin mx-auto" /> : 'Create Account'}
        </button>

        <p className="text-center text-sm text-slate-500">
          Already have an account? <a href="/login" className="text-indigo-600 font-semibold">Log in</a>
        </p>
      </form>
    </div>
  );
}
