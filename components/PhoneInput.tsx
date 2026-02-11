'use client';

import React, { useId, useState, useRef, useEffect } from 'react';

export type CountryOption = { code: string; dial: string; name: string };

export const COUNTRY_CODES: CountryOption[] = [
  { code: 'US', dial: '+1', name: 'United States' },
  { code: 'CA', dial: '+1', name: 'Canada' },
  { code: 'GB', dial: '+44', name: 'United Kingdom' },
  { code: 'AU', dial: '+61', name: 'Australia' },
  { code: 'DE', dial: '+49', name: 'Germany' },
  { code: 'FR', dial: '+33', name: 'France' },
  { code: 'IN', dial: '+91', name: 'India' },
  { code: 'MX', dial: '+52', name: 'Mexico' },
  { code: 'BR', dial: '+55', name: 'Brazil' },
  { code: 'ES', dial: '+34', name: 'Spain' },
  { code: 'IT', dial: '+39', name: 'Italy' },
  { code: 'NL', dial: '+31', name: 'Netherlands' },
  { code: 'AE', dial: '+971', name: 'UAE' },
  { code: 'SA', dial: '+966', name: 'Saudi Arabia' },
  { code: 'EG', dial: '+20', name: 'Egypt' },
  { code: 'ZA', dial: '+27', name: 'South Africa' },
  { code: 'NG', dial: '+234', name: 'Nigeria' },
  { code: 'KE', dial: '+254', name: 'Kenya' },
  { code: 'PK', dial: '+92', name: 'Pakistan' },
  { code: 'BD', dial: '+880', name: 'Bangladesh' },
  { code: 'PH', dial: '+63', name: 'Philippines' },
  { code: 'VN', dial: '+84', name: 'Vietnam' },
  { code: 'TH', dial: '+66', name: 'Thailand' },
  { code: 'ID', dial: '+62', name: 'Indonesia' },
  { code: 'MY', dial: '+60', name: 'Malaysia' },
  { code: 'SG', dial: '+65', name: 'Singapore' },
  { code: 'JP', dial: '+81', name: 'Japan' },
  { code: 'KR', dial: '+82', name: 'South Korea' },
  { code: 'CN', dial: '+86', name: 'China' },
  { code: 'RU', dial: '+7', name: 'Russia' },
  { code: 'TR', dial: '+90', name: 'Turkey' },
  { code: 'PL', dial: '+48', name: 'Poland' },
  { code: 'AR', dial: '+54', name: 'Argentina' },
  { code: 'CO', dial: '+57', name: 'Colombia' },
  { code: 'CL', dial: '+56', name: 'Chile' },
  { code: 'PE', dial: '+51', name: 'Peru' },
  { code: 'IQ', dial: '+964', name: 'Iraq' },
  { code: 'JO', dial: '+962', name: 'Jordan' },
  { code: 'LB', dial: '+961', name: 'Lebanon' },
  { code: 'KW', dial: '+965', name: 'Kuwait' },
  { code: 'QA', dial: '+974', name: 'Qatar' },
  { code: 'BH', dial: '+973', name: 'Bahrain' },
  { code: 'OM', dial: '+968', name: 'Oman' },
  { code: 'YE', dial: '+967', name: 'Yemen' },
  { code: 'SY', dial: '+963', name: 'Syria' },
  { code: 'PS', dial: '+970', name: 'Palestine' },
  { code: 'IL', dial: '+972', name: 'Israel' },
  { code: 'IR', dial: '+98', name: 'Iran' },
  { code: 'AF', dial: '+93', name: 'Afghanistan' },
  { code: 'LK', dial: '+94', name: 'Sri Lanka' },
  { code: 'NP', dial: '+977', name: 'Nepal' },
  { code: 'MM', dial: '+95', name: 'Myanmar' },
  { code: 'KH', dial: '+855', name: 'Cambodia' },
  { code: 'LA', dial: '+856', name: 'Laos' },
  { code: 'NZ', dial: '+64', name: 'New Zealand' },
  { code: 'IE', dial: '+353', name: 'Ireland' },
  { code: 'PT', dial: '+351', name: 'Portugal' },
  { code: 'GR', dial: '+30', name: 'Greece' },
  { code: 'RO', dial: '+40', name: 'Romania' },
  { code: 'HU', dial: '+36', name: 'Hungary' },
  { code: 'CZ', dial: '+420', name: 'Czech Republic' },
  { code: 'SE', dial: '+46', name: 'Sweden' },
  { code: 'NO', dial: '+47', name: 'Norway' },
  { code: 'DK', dial: '+45', name: 'Denmark' },
  { code: 'FI', dial: '+358', name: 'Finland' },
  { code: 'BE', dial: '+32', name: 'Belgium' },
  { code: 'CH', dial: '+41', name: 'Switzerland' },
  { code: 'AT', dial: '+43', name: 'Austria' },
  { code: 'GH', dial: '+233', name: 'Ghana' },
  { code: 'ET', dial: '+251', name: 'Ethiopia' },
  { code: 'TZ', dial: '+255', name: 'Tanzania' },
  { code: 'UG', dial: '+256', name: 'Uganda' },
  { code: 'MA', dial: '+212', name: 'Morocco' },
  { code: 'TN', dial: '+216', name: 'Tunisia' },
  { code: 'DZ', dial: '+213', name: 'Algeria' },
  { code: 'LY', dial: '+218', name: 'Libya' },
  { code: 'SD', dial: '+249', name: 'Sudan' },
  { code: 'OTHER', dial: '+1', name: 'Other' },
];

function getFlagEmoji(countryCode: string): string {
  if (countryCode === 'OTHER') return '🌐';
  const codePoints = countryCode
    .split('')
    .map((c) => 0x1f1e6 - 65 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

type PhoneInputProps = {
  value: string;
  onChange: (fullNumber: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
};

export function PhoneInput({
  value,
  onChange,
  placeholder = 'Phone number',
  disabled,
  id: idProp,
  className = '',
  'aria-label': ariaLabel,
}: PhoneInputProps) {
  const id = useId();
  const inputId = idProp || `phone-${id}`;
  const [countryIndex, setCountryIndex] = useState(0);
  const [localNumber, setLocalNumber] = useState('');
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = COUNTRY_CODES[countryIndex];
  const dial = selected.dial;

  useEffect(() => {
    if (!value || !value.startsWith('+')) {
      setLocalNumber('');
      return;
    }
    const byLongestDial = [...COUNTRY_CODES]
      .map((c, i) => ({ c, i }))
      .sort((a, b) => b.c.dial.length - a.c.dial.length);
    for (const { c, i } of byLongestDial) {
      if (value === c.dial || value.startsWith(c.dial)) {
        const rest = value.slice(c.dial.length).replace(/\D/g, '');
        setCountryIndex(i);
        setLocalNumber(rest);
        return;
      }
    }
    setLocalNumber(value.replace(/\D/g, ''));
  }, [value]);

  const syncUp = (idx: number, num: string) => {
    const d = COUNTRY_CODES[idx].dial;
    const digits = num.replace(/\D/g, '');
    const full = digits ? `${d}${digits}` : '';
    onChange(full);
  };

  const handleCountryChange = (idx: number) => {
    setCountryIndex(idx);
    setOpen(false);
    syncUp(idx, localNumber);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '');
    setLocalNumber(v);
    syncUp(countryIndex, v);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  return (
    <div className={`relative flex w-full rounded-xl border border-slate-200 focus-within:border-indigo-600 ${className}`}>
      <div className="relative" ref={listRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-l-xl border-r border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset disabled:opacity-50"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Country code"
        >
          <span className="text-lg leading-none" aria-hidden>
            {getFlagEmoji(selected.code)}
          </span>
          <span className="font-medium text-slate-700">{dial}</span>
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div
            role="listbox"
            className="absolute left-0 top-full z-50 mt-1 max-h-56 w-64 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          >
            {COUNTRY_CODES.map((c, i) => (
              <button
                key={`${c.code}-${c.dial}`}
                type="button"
                role="option"
                aria-selected={i === countryIndex}
                onClick={() => handleCountryChange(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-indigo-50 ${i === countryIndex ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-700'}`}
              >
                <span className="text-lg">{getFlagEmoji(c.code)}</span>
                <span>{c.dial}</span>
                <span className="text-slate-500">{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        id={inputId}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        placeholder={placeholder}
        value={localNumber}
        onChange={handleNumberChange}
        disabled={disabled}
        aria-label={ariaLabel ?? 'Phone number'}
        className="w-full rounded-r-xl px-4 py-3 text-sm outline-none placeholder:text-slate-400"
      />
    </div>
  );
}
