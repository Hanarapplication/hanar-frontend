'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Turnstile } from '@marsidev/react-turnstile';
import toast from 'react-hot-toast';
import {
  User,
  Building2,
  Landmark,
  Eye,
  EyeOff,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import { PhoneInput } from '@/components/PhoneInput';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

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
  const { effectiveLang } = useLanguage();

  const [role, setRole] = useState<Role>('individual');
  const [clicked, setClicked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '' as '' | 'man' | 'woman' | 'she' | 'he' | 'they',
    fullName: '',
    businessName: '',
    organizationName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    website: '', // honeypot - bots fill this
  });

  const [genderMoreExpanded, setGenderMoreExpanded] = useState(false);

  const GENDER_MAIN = [
    { value: 'man' as const, label: t(effectiveLang, 'Man') },
    { value: 'woman' as const, label: t(effectiveLang, 'Woman') },
    { value: 'more' as const, label: t(effectiveLang, 'More options') },
  ];
  const GENDER_MORE_OPTIONS: { value: 'she' | 'he' | 'they'; label: string }[] = [
    { value: 'she', label: t(effectiveLang, 'She') },
    { value: 'he', label: t(effectiveLang, 'He') },
    { value: 'they', label: t(effectiveLang, 'They') },
  ];

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

  const fullName = [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(' ');
  const name =
    role === 'business'
      ? form.businessName
      : role === 'organization'
      ? form.organizationName
      : fullName;

  /* ---------- Submit ---------- */

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.firstName?.trim()) return toast.error(t(effectiveLang, 'First name is required'));
    if (!form.lastName?.trim()) return toast.error(t(effectiveLang, 'Last name is required'));
    if (!form.dateOfBirth?.trim()) return toast.error(t(effectiveLang, 'Date of birth is required'));
    const dob = new Date(form.dateOfBirth);
    if (Number.isNaN(dob.getTime())) return toast.error(t(effectiveLang, 'Invalid date of birth'));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dob >= today) return toast.error(t(effectiveLang, 'Date of birth must be in the past'));
    const age = (today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (age < 13) return toast.error(t(effectiveLang, 'You must be at least 13 years old'));
    if ((role === 'business' || role === 'organization') && age < 18) return toast.error(t(effectiveLang, 'You must be at least 18 years old to create a business or organization account'));
    if (role === 'individual' && !form.gender) return toast.error(t(effectiveLang, 'Please select your gender'));
    if (!name || name.length < 3) return toast.error(t(effectiveLang, 'Name too short'));
    if ((role === 'business' || role === 'organization') && !form.phone?.trim()) return toast.error(t(effectiveLang, 'Please enter your phone number'));
    if (!passwordMatch) return toast.error(t(effectiveLang, 'Passwords do not match'));
    if (passwordStrength < 3) return toast.error(t(effectiveLang, 'Password too weak'));
    if (!agreed) return toast.error(t(effectiveLang, 'Accept Terms'));
    if (!turnstileToken) return toast.error(t(effectiveLang, 'Please complete the verification'));

    try {
      setClicked(true);

      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          dateOfBirth: form.dateOfBirth.trim(),
          fullName,
          gender: role === 'individual' ? form.gender || undefined : undefined,
          email: form.email,
          password: form.password,
          role,
          phone: role === 'business' || role === 'organization' ? (form.phone?.trim() || undefined) : undefined,
          turnstileToken,
          website: form.website,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t(effectiveLang, 'Registration failed'));

      toast.success(t(effectiveLang, 'Account created. Please log in.'));
      router.push('/login'); // ✅ REDIRECT HERE

    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setClicked(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form onSubmit={handleRegister} className="w-full max-w-xl mx-auto bg-white rounded-3xl p-10 space-y-8 shadow-xl">
        <div className="flex justify-center">
          <img
            src="/hanar.logo.png"
            alt="Hanar"
            width={100}
            height={100}
            className="h-16 w-auto object-contain"
          />
        </div>
        <h1 className="text-3xl font-bold text-center">{t(effectiveLang, 'Create Account')}</h1>

        <div className="grid grid-cols-3 gap-3">
          <RoleOption value="individual" label={t(effectiveLang, 'Individual')} desc={t(effectiveLang, 'Personal use')} icon={User} currentRole={role} setRole={setRole} />
          <RoleOption value="business" label={t(effectiveLang, 'Business')} desc={t(effectiveLang, 'Sell & promote')} icon={Building2} currentRole={role} setRole={setRole} />
          <RoleOption value="organization" label={t(effectiveLang, 'Org')} desc={t(effectiveLang, 'Community')} icon={Landmark} currentRole={role} setRole={setRole} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FloatingInput id="firstName" placeholder={t(effectiveLang, 'First Name')} value={form.firstName} onChange={handleChange} disabled={clicked} />
          <FloatingInput id="lastName" placeholder={t(effectiveLang, 'Last Name')} value={form.lastName} onChange={handleChange} disabled={clicked} />
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <label htmlFor="dateOfBirth" className="text-xs font-semibold text-indigo-600">
              {t(effectiveLang, 'Date of Birth')}
            </label>
            <div className="relative group inline-flex">
              <button
                type="button"
                className="text-slate-400 hover:text-indigo-600 focus:text-indigo-600 focus:outline-none rounded-full p-0.5"
                aria-label={t(effectiveLang, 'Why we ask for date of birth')}
              >
                <HelpCircle className="h-4 w-4" />
              </button>
              <div className="absolute left-0 top-full mt-1 z-10 w-72 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs text-slate-600 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
                <p className="font-semibold text-slate-800 mb-1.5">{t(effectiveLang, 'Why we ask for your date of birth')}</p>
                <p>
                  {t(effectiveLang, 'We collect your date of birth to comply with laws that protect minors online (such as COPPA in the US and similar regulations elsewhere). We use it to verify that users meet our minimum age requirement. This helps keep underage users off the platform as required by law and our Terms of Service.')}
                </p>
              </div>
            </div>
          </div>
          <FloatingInput id="dateOfBirth" type="date" placeholder={t(effectiveLang, 'Date of Birth')} value={form.dateOfBirth} onChange={handleChange} disabled={clicked} />
        </div>

        {role === 'individual' && (
          <div>
            <label className="mb-2 block text-xs font-semibold text-indigo-600">{t(effectiveLang, 'Gender')}</label>
            <div className="flex flex-wrap gap-2">
              {GENDER_MAIN.map((opt) => (
                <label
                  key={opt.value}
                  className={`cursor-pointer rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                    opt.value === 'more'
                      ? genderMoreExpanded
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
                      : form.gender === opt.value
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="gender"
                    value={opt.value}
                    checked={opt.value === 'more' ? genderMoreExpanded : form.gender === opt.value}
                    onChange={() => {
                      if (opt.value === 'more') {
                        const willExpand = !genderMoreExpanded;
                        setGenderMoreExpanded(willExpand);
                        if (willExpand) setForm((p) => ({ ...p, gender: '' }));
                      } else {
                        setGenderMoreExpanded(false);
                        setForm((p) => ({ ...p, gender: opt.value }));
                      }
                    }}
                    disabled={clicked}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {genderMoreExpanded && (
              <div className="mt-2 flex flex-wrap gap-2 pl-0">
                {GENDER_MORE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`cursor-pointer rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                      form.gender === opt.value
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="genderSub"
                      value={opt.value}
                      checked={form.gender === opt.value}
                      onChange={() => setForm((p) => ({ ...p, gender: opt.value }))}
                      disabled={clicked}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {role === 'business' && (
          <>
            <div>
              <label htmlFor="phone-business" className="mb-1.5 block text-xs font-semibold text-indigo-600">{t(effectiveLang, 'Phone number')}</label>
              <PhoneInput
                id="phone-business"
                value={form.phone}
                onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                placeholder={t(effectiveLang, 'e.g. 202 555 1234')}
                disabled={clicked}
              />
            </div>
            <FloatingInput id="businessName" placeholder={t(effectiveLang, 'Business Name')} value={form.businessName} onChange={handleChange} disabled={clicked} />
          </>
        )}

        {role === 'organization' && (
          <>
            <div>
              <label htmlFor="phone-org" className="mb-1.5 block text-xs font-semibold text-indigo-600">{t(effectiveLang, 'Phone number')}</label>
              <PhoneInput
                id="phone-org"
                value={form.phone}
                onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                placeholder={t(effectiveLang, 'e.g. 202 555 1234')}
                disabled={clicked}
              />
            </div>
            <FloatingInput id="organizationName" placeholder={t(effectiveLang, 'Organization Name')} value={form.organizationName} onChange={handleChange} disabled={clicked} />
          </>
        )}

        <FloatingInput id="email" type="email" placeholder={t(effectiveLang, 'Email')} value={form.email} onChange={handleChange} disabled={clicked} />
        <FloatingInput id="password" placeholder={t(effectiveLang, 'Password')} isPassword showPassword={showPassword} setShowPassword={setShowPassword} value={form.password} onChange={handleChange} disabled={clicked} />
        <FloatingInput id="confirmPassword" placeholder={t(effectiveLang, 'Confirm Password')} isPassword showPassword={showPassword} setShowPassword={setShowPassword} value={form.confirmPassword} onChange={handleChange} disabled={clicked} error={!passwordMatch ? t(effectiveLang, 'Passwords do not match') : null} />

        <div className="sr-only" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input id="website" type="text" value={form.website} onChange={handleChange} tabIndex={-1} autoComplete="off" />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={agreed} onChange={() => setAgreed(!agreed)} />
          {t(effectiveLang, 'I agree to the Terms & Privacy Policy')}
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
          {clicked ? <Loader2 className="animate-spin mx-auto" /> : t(effectiveLang, 'Create Account')}
        </button>

        <p className="text-center text-sm text-slate-500">
          {t(effectiveLang, 'Already have an account?')} <a href="/login" className="text-indigo-600 font-semibold">{t(effectiveLang, 'Log in')}</a>
        </p>
      </form>
    </div>
  );
}
