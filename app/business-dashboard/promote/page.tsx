'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, ImagePlus, Home, Users, Globe, ExternalLink, Check, Target } from 'lucide-react';
import { spokenLanguagesWithDialects, predefinedLanguageCodes } from '@/utils/languages';

type Placement = 'home_feed' | 'community' | 'universal';
type LinkType = 'business_page' | 'external';
type Tier = 'basic' | 'targeted' | 'premium';
type AudienceType = 'universal' | 'targeted';

type GenderOption = 'all' | 'man' | 'woman' | 'others';
const GENDER_OPTIONS: { value: GenderOption; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'man', label: 'Man' },
  { value: 'woman', label: 'Woman' },
  { value: 'others', label: 'Others' },
];
const TARGET_AGE_GROUPS = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'] as const;

const PLACEMENTS: { value: Placement; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'home_feed', label: 'Home feed', desc: 'Banner in the main feed', icon: <Home className="h-5 w-5" /> },
  { value: 'community', label: 'Community', desc: 'Show in community section', icon: <Users className="h-5 w-5" /> },
  { value: 'universal', label: 'Universal', desc: 'Everywhere (feed + community)', icon: <Globe className="h-5 w-5" /> },
];

const TIER_LABELS: Record<Tier, string> = {
  basic: 'BASIC (Random Feed Rotation)',
  targeted: 'TARGETED (Language OR Geo)',
  premium: 'PREMIUM (Language + Geo)',
};

const DURATION_OPTIONS = [
  { days: 14, label: '2 Weeks' },
  { days: 30, label: '1 Month' },
  { days: 90, label: '3 Months' },
  { days: 180, label: '6 Months' },
  { days: 365, label: '1 Year' },
];

export default function PromotePage() {
  const router = useRouter();
  const [business, setBusiness] = useState<{ id: string; business_name: string; slug: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [placement, setPlacement] = useState<Placement>('home_feed');
  const [audienceType, setAudienceType] = useState<AudienceType>('universal');
  const [genderOption, setGenderOption] = useState<GenderOption>('all');
  const [targetAgeGroups, setTargetAgeGroups] = useState<string[]>([]);
  const [targetLanguages, setTargetLanguages] = useState<string[]>([]);
  const [newTargetLanguageInput, setNewTargetLanguageInput] = useState('');
  const [targetLocations, setTargetLocations] = useState<string>('');
  const [linkType, setLinkType] = useState<LinkType>('business_page');
  const [linkValue, setLinkValue] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [tier, setTier] = useState<Tier>('basic');
  const [durationDays, setDurationDays] = useState(30);
  const [pricing, setPricing] = useState<Record<string, { duration_days: number; price_cents: number; label: string }[]>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        router.replace('/login');
        return;
      }
      const { data } = await supabase
        .from('businesses')
        .select('id, business_name, slug')
        .eq('owner_id', session.user.id)
        .maybeSingle();
      if (mounted && data) setBusiness(data);
      else if (mounted && !data) router.replace('/business-dashboard');
      setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, [router]);

  useEffect(() => {
    fetch('/api/promotion-pricing')
      .then((r) => r.json())
      .then((d) => {
        if (d.pricing) setPricing(d.pricing);
      })
      .catch(() => {});
  }, []);

  const priceCents = pricing[tier]?.find((p) => p.duration_days === durationDays)?.price_cents ?? 0;
  const priceDisplay = priceCents ? `$${(priceCents / 100).toFixed(0)}` : '—';

  const handleSubmit = async () => {
    if (!business) return;
    if (linkType === 'external' && !linkValue.trim()) {
      toast.error('Enter your website or external link');
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set('business_id', business.id);
      form.set('placement', placement);
      form.set('audience_type', audienceType);
      if (audienceType === 'targeted') {
        if (genderOption === 'man') form.set('target_genders', JSON.stringify(['man']));
        else if (genderOption === 'woman') form.set('target_genders', JSON.stringify(['woman']));
        else if (genderOption === 'others') form.set('target_genders', JSON.stringify(['he', 'she', 'they']));
        if (targetAgeGroups.length) form.set('target_age_groups', JSON.stringify(targetAgeGroups));
        if (targetLanguages.length) form.set('target_languages', JSON.stringify(targetLanguages));
        const locs = targetLocations.trim().split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
        if (locs.length) form.set('target_locations', JSON.stringify(locs));
      }
      form.set('link_type', linkType);
      form.set('link_value', linkType === 'external' ? linkValue.trim() : '');
      form.set('description', description.trim());
      form.set('tier', tier);
      form.set('duration_days', String(durationDays));
      form.set('price_cents', String(priceCents));
      if (file) form.set('image', file);

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/business/promotion-request', {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Submit failed');
      toast.success(file ? 'Promotion request submitted. We’ll review and may adjust the banner if needed.' : 'Promotion request submitted. Our team will create your banner from your description.');
      router.push('/business-dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !business) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/business-dashboard" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-slate-900 mb-1">Promote your business</h1>
        <p className="text-slate-600 mb-8">Choose where your banner appears, upload creative, and select a plan.</p>

        {/* Step indicator */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(s)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                step === s ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              {s === 1 ? 'Placement' : s === 2 ? 'Creative' : 'Pricing'}
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Where should your banner show?</h2>
            <p className="text-sm text-slate-500 mb-4">Select one placement option.</p>
            <div className="space-y-3">
              {PLACEMENTS.map((p) => (
                <label
                  key={p.value}
                  className={`flex items-center gap-4 rounded-xl border-2 p-4 cursor-pointer transition ${
                    placement === p.value ? 'border-amber-500 bg-amber-50/50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input type="radio" name="placement" value={p.value} checked={placement === p.value} onChange={() => setPlacement(p.value)} className="sr-only" />
                  <span className="text-amber-600">{p.icon}</span>
                  <div>
                    <p className="font-medium text-slate-900">{p.label}</p>
                    <p className="text-sm text-slate-500">{p.desc}</p>
                  </div>
                  {placement === p.value && <Check className="h-5 w-5 text-amber-600 ml-auto" />}
                </label>
              ))}
            </div>

            {/* Audience: Universal vs Targeted */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Target className="h-5 w-5 text-amber-600" />
                Who should see this promotion?
              </h2>
              <p className="text-sm text-slate-500 mb-4">Universal shows to everyone; targeted limits by gender, age, location, or language.</p>
              <div className="space-y-3 mb-4">
                <label className={`flex items-center gap-4 rounded-xl border-2 p-4 cursor-pointer transition ${audienceType === 'universal' ? 'border-amber-500 bg-amber-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" name="audience" value="universal" checked={audienceType === 'universal'} onChange={() => setAudienceType('universal')} className="sr-only" />
                  <Globe className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-slate-900">Universal</p>
                    <p className="text-sm text-slate-500">Show to everyone</p>
                  </div>
                  {audienceType === 'universal' && <Check className="h-5 w-5 text-amber-600 ml-auto" />}
                </label>
                <label className={`flex items-center gap-4 rounded-xl border-2 p-4 cursor-pointer transition ${audienceType === 'targeted' ? 'border-amber-500 bg-amber-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" name="audience" value="targeted" checked={audienceType === 'targeted'} onChange={() => setAudienceType('targeted')} className="sr-only" />
                  <Target className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-slate-900">Targeted</p>
                    <p className="text-sm text-slate-500">Filter by gender, age, location, or language</p>
                  </div>
                  {audienceType === 'targeted' && <Check className="h-5 w-5 text-amber-600 ml-auto" />}
                </label>
              </div>

              {audienceType === 'targeted' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">Gender (optional)</p>
                    <div className="flex flex-wrap gap-2">
                      {GENDER_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                            genderOption === opt.value
                              ? 'border-amber-500 bg-amber-50 text-amber-800'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="genderOption"
                            value={opt.value}
                            checked={genderOption === opt.value}
                            onChange={() => setGenderOption(opt.value)}
                            className="sr-only"
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">Age groups (optional)</p>
                    <div className="flex flex-wrap gap-2">
                      {TARGET_AGE_GROUPS.map((a) => (
                        <label key={a} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm cursor-pointer hover:bg-slate-50">
                          <input type="checkbox" checked={targetAgeGroups.includes(a)} onChange={() => setTargetAgeGroups((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]))} />
                          <span>{a}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">Spoken languages (optional)</p>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {spokenLanguagesWithDialects.map(({ code, label, flag }) => (
                        <label key={code} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm cursor-pointer hover:bg-slate-50">
                          <input type="checkbox" checked={targetLanguages.includes(code)} onChange={() => setTargetLanguages((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]))} />
                          <span aria-hidden>{flag}</span>
                          <span>{label}</span>
                        </label>
                      ))}
                      {targetLanguages.filter((c) => !predefinedLanguageCodes.has(c)).map((custom) => (
                        <span
                          key={custom}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
                        >
                          <span aria-hidden>🌐</span>
                          <span>{custom}</span>
                          <button
                            type="button"
                            onClick={() => setTargetLanguages((prev) => prev.filter((x) => x !== custom))}
                            className="ml-1 rounded p-0.5 hover:bg-slate-100"
                            aria-label="Remove"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={newTargetLanguageInput}
                        onChange={(e) => setNewTargetLanguageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const v = newTargetLanguageInput.trim();
                            if (v && !targetLanguages.includes(v)) {
                              setTargetLanguages((prev) => [...prev, v]);
                              setNewTargetLanguageInput('');
                            }
                          }
                        }}
                        placeholder="Add another language"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm w-48"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const v = newTargetLanguageInput.trim();
                          if (v && !targetLanguages.includes(v)) {
                            setTargetLanguages((prev) => [...prev, v]);
                            setNewTargetLanguageInput('');
                          }
                        }}
                        className="rounded-lg bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-300"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1">Locations (optional)</p>
                    <p className="text-xs text-slate-500 mb-2">Comma-separated state codes or city names (e.g. CA, NY, Dallas). Leave empty for all regions.</p>
                    <textarea
                      value={targetLocations}
                      onChange={(e) => setTargetLocations(e.target.value)}
                      placeholder="e.g. CA, TX, New York"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>

            <button type="button" onClick={() => setStep(2)} className="mt-6 w-full rounded-xl bg-amber-600 py-3 font-semibold text-white hover:bg-amber-500">
              Next: Creative
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Banner & link</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Banner image (1200×630 recommended)</label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  id="promo-file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <label htmlFor="promo-file" className="cursor-pointer">
                  {file ? (
                    <div>
                      <img src={URL.createObjectURL(file)} alt="Preview" className="mx-auto max-h-32 rounded-lg object-contain" />
                      <p className="mt-2 text-sm text-slate-600">{file.name}</p>
                    </div>
                  ) : (
                    <div className="text-slate-500">
                      <ImagePlus className="mx-auto h-10 w-10" />
                      <p className="mt-2 text-sm">Upload banner or we can fix it for you</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Where should the banner link to?</label>
              <div className="flex gap-4 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="linkType" checked={linkType === 'business_page'} onChange={() => setLinkType('business_page')} />
                  <span className="text-slate-700">My business page</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="linkType" checked={linkType === 'external'} onChange={() => setLinkType('external')} />
                  <span className="text-slate-700">External website</span>
                </label>
              </div>
              {linkType === 'business_page' && (
                <p className="text-sm text-slate-500">Links to: /business/{business.slug}</p>
              )}
              {linkType === 'external' && (
                <input
                  type="url"
                  value={linkValue}
                  onChange={(e) => setLinkValue(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description / slogan / what to show</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. slogan, website, special offer..."
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 placeholder:text-slate-400"
              />
              <p className="text-xs text-slate-500 mt-1">We may adjust the banner design based on this.</p>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50">
                Back
              </button>
              <button type="button" onClick={() => setStep(3)} className="flex-1 rounded-xl bg-amber-600 py-3 font-semibold text-white hover:bg-amber-500">
                Next: Pricing
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Choose your plan</h2>

            <div className="space-y-4">
              {(['basic', 'targeted', 'premium'] as Tier[]).map((t) => (
                <div key={t} className={`rounded-xl border-2 p-4 ${tier === t ? 'border-amber-500 bg-amber-50/30' : 'border-slate-200'}`}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="radio" name="tier" value={t} checked={tier === t} onChange={() => setTier(t)} className="mt-1" />
                    <div>
                      <p className="font-semibold text-slate-900">{TIER_LABELS[t]}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {DURATION_OPTIONS.map((d) => (
                          <button
                            key={d.days}
                            type="button"
                            onClick={() => setDurationDays(d.days)}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                              durationDays === d.days ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {d.label}: ${((pricing[t]?.find((p) => p.duration_days === d.days)?.price_cents ?? 0) / 100).toFixed(0)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </label>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-slate-100 p-4 flex items-center justify-between">
              <span className="font-medium text-slate-900">Total</span>
              <span className="text-xl font-bold text-amber-600">{priceDisplay}</span>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(2)} className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50">
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-xl bg-amber-600 py-3 font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit for review'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
