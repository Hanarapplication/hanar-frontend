'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, ImagePlus, Home, Users, Globe, Check, Target, MapPin, X } from 'lucide-react';
import { spokenLanguagesWithDialects, predefinedLanguageCodes } from '@/utils/languages';

type Placement = 'home_feed' | 'community' | 'universal';
type LinkType = 'organization_page' | 'external';
type Tier = 'basic' | 'targeted' | 'premium';
type AudienceType = 'universal' | 'targeted';

const MAX_CITIES_BASIC = 3;
const MAX_CITIES_TARGETED = 10;
const MAX_CITIES_PREMIUM = 100; // "unlimited"
const CITY_SEARCH_DEBOUNCE_MS = 300;

type GenderOption = 'all' | 'man' | 'woman' | 'others';
const GENDER_OPTIONS: { value: GenderOption; label: string }[] = [
  { value: 'all', label: 'All genders' },
  { value: 'man', label: 'Man' },
  { value: 'woman', label: 'Woman' },
  { value: 'others', label: 'Others' },
];
const TARGET_AGE_GROUPS = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'] as const;

function maxCitiesForTier(tier: Tier): number {
  return tier === 'basic' ? MAX_CITIES_BASIC : tier === 'targeted' ? MAX_CITIES_TARGETED : MAX_CITIES_PREMIUM;
}

const PLACEMENTS: { value: Placement; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'home_feed', label: 'Home feed', desc: 'Placard in the main feed', icon: <Home className="h-5 w-5" /> },
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

export default function OrganizationPromotePage() {
  const router = useRouter();
  const [organization, setOrganization] = useState<{ id: string; full_name: string; username: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [placement, setPlacement] = useState<Placement>('home_feed');
  const [audienceType, setAudienceType] = useState<AudienceType>('universal');
  const [genderOption, setGenderOption] = useState<GenderOption>('all');
  const [ageScope, setAgeScope] = useState<'all' | 'specific'>('all');
  const [languageScope, setLanguageScope] = useState<'all' | 'specific'>('all');
  const [targetAgeGroups, setTargetAgeGroups] = useState<string[]>([]);
  const [targetLanguages, setTargetLanguages] = useState<string[]>([]);
  const [newTargetLanguageInput, setNewTargetLanguageInput] = useState('');
  const [targetCities, setTargetCities] = useState<Array<{ label: string; lat: number; lng: number }>>([]);
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [citySearchResults, setCitySearchResults] = useState<Array<{ label: string; lat: number; lng: number }>>([]);
  const [citySearchOpen, setCitySearchOpen] = useState(false);
  const [citySearchLoading, setCitySearchLoading] = useState(false);
  const citySearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const citySearchWrapRef = useRef<HTMLDivElement>(null);
  const [linkType, setLinkType] = useState<LinkType>('organization_page');
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
      const { data: reg } = await supabase
        .from('registeredaccounts')
        .select('organization')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!reg?.organization) {
        router.replace('/organization/dashboard');
        return;
      }
      const { data } = await supabase
        .from('organizations')
        .select('id, full_name, username')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (mounted && data) setOrganization(data);
      else if (mounted && !data) router.replace('/organization/dashboard');
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

  const fetchCitySearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setCitySearchResults([]);
      return;
    }
    setCitySearchLoading(true);
    try {
      const res = await fetch(`/api/geocode/cities?q=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => ({}));
      setCitySearchResults(Array.isArray(data.results) ? data.results : []);
    } catch {
      setCitySearchResults([]);
    } finally {
      setCitySearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (citySearchRef.current) clearTimeout(citySearchRef.current);
    if (!citySearchQuery.trim()) {
      setCitySearchResults([]);
      setCitySearchOpen(false);
      return;
    }
    setCitySearchOpen(true);
    citySearchRef.current = setTimeout(() => {
      fetchCitySearch(citySearchQuery.trim());
      citySearchRef.current = null;
    }, CITY_SEARCH_DEBOUNCE_MS);
    return () => {
      if (citySearchRef.current) clearTimeout(citySearchRef.current);
    };
  }, [citySearchQuery, fetchCitySearch]);

  const addTargetCity = (city: { label: string; lat: number; lng: number }) => {
    const exists = targetCities.some((c) => c.label === city.label);
    const max = maxCitiesForTier(tier);
    if (exists || targetCities.length >= max) return;
    setTargetCities((prev) => [...prev, city]);
    setCitySearchQuery('');
    setCitySearchResults([]);
    setCitySearchOpen(false);
  };

  const removeTargetCity = (index: number) => {
    setTargetCities((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (citySearchWrapRef.current && !citySearchWrapRef.current.contains(e.target as Node)) {
        setCitySearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const max = maxCitiesForTier(tier);
    setTargetCities((prev) => (prev.length <= max ? prev : prev.slice(0, max)));
  }, [tier]);

  const priceCents = pricing[tier]?.find((p) => p.duration_days === durationDays)?.price_cents ?? 0;
  const priceDisplay = priceCents ? `$${(priceCents / 100).toFixed(0)}` : '—';

  const handlePayAndSubmit = async () => {
    if (!organization) return;
    if (targetCities.length === 0) {
      toast.error('Please add at least one city to continue');
      return;
    }
    if (linkType === 'external' && !linkValue.trim()) {
      toast.error('Enter your website or external link');
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set('source', 'organization');
      form.set('organization_id', organization.id);
      form.set('placement', placement);
      // BASIC = up to 3 cities only (everyone in those areas), no demographic targeting
      // TARGETED = language + up to 10 cities. PREMIUM = language + unlimited cities + gender + age
      const isBasic = tier === 'basic';
      const isTargetedOrPremium = tier === 'targeted' || tier === 'premium';
      const basicWithCities = isBasic && targetCities.length > 0;
      const effectiveAudience = basicWithCities ? 'targeted' : (isTargetedOrPremium ? audienceType : 'universal');
      form.set('audience_type', effectiveAudience);

      if (effectiveAudience === 'targeted') {
        if (basicWithCities) {
          form.set('target_locations', JSON.stringify(targetCities.slice(0, MAX_CITIES_BASIC).map((c) => c.label)));
        } else if (isTargetedOrPremium) {
          if (targetLanguages.length) form.set('target_languages', JSON.stringify(targetLanguages));
          const locs = tier === 'targeted' ? targetCities.slice(0, MAX_CITIES_TARGETED) : targetCities;
          if (locs.length) form.set('target_locations', JSON.stringify(locs.map((c) => c.label)));
          if (tier === 'premium') {
            if (genderOption === 'man') form.set('target_genders', JSON.stringify(['man']));
            else if (genderOption === 'woman') form.set('target_genders', JSON.stringify(['woman']));
            else if (genderOption === 'others') form.set('target_genders', JSON.stringify(['he', 'she', 'they']));
            if (targetAgeGroups.length) form.set('target_age_groups', JSON.stringify(targetAgeGroups));
          }
        }
      }
      form.set('link_type', linkType);
      form.set('link_value', linkType === 'external' ? linkValue.trim() : '');
      form.set('description', description.trim());
      form.set('tier', tier);
      form.set('duration_days', String(durationDays));
      form.set('price_cents', String(priceCents));
      if (file) form.set('image', file);

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/promotion-request', {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: form,
      });
      const text = await res.text();
      let data: { error?: string; request?: { id: string } } = {};
      try {
        if (text) data = JSON.parse(text);
      } catch {
        data = { error: res.statusText || 'Request failed' };
      }
      if (!res.ok) throw new Error(data?.error || res.statusText || 'Submit failed');

      const requestId = data.request?.id;
      const checkoutRes = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          type: 'org_promotion',
          organizationId: organization.id,
          tier,
          durationDays,
          orgPromotionRequestId: requestId || undefined,
        }),
      });
      const checkoutData = await checkoutRes.json().catch(() => ({}));
      if (!checkoutRes.ok) throw new Error(checkoutData?.error || 'Checkout failed');
      if (checkoutData?.url) {
        window.location.href = checkoutData.url;
        return;
      }
      throw new Error('No checkout URL returned');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !organization) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <p className="text-slate-500 dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/organization/dashboard" className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Promote your message</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">Add a placard with your event or message. Same pricing as business ad banners—choose placement, upload your sign, and pay.</p>

        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(s)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                step === s ? 'bg-amber-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              {s === 1 ? 'Placement' : s === 2 ? 'Placard' : 'Pricing'}
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Where should your placard show?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Select one placement option.</p>
            <div className="space-y-3">
              {PLACEMENTS.map((p) => (
                <label
                  key={p.value}
                  className={`flex items-center gap-4 rounded-xl border-2 p-4 cursor-pointer transition ${
                    placement === p.value ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                  }`}
                >
                  <input type="radio" name="placement" value={p.value} checked={placement === p.value} onChange={() => setPlacement(p.value)} className="sr-only" />
                  <span className="text-amber-600">{p.icon}</span>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{p.label}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{p.desc}</p>
                  </div>
                  {placement === p.value && <Check className="h-5 w-5 text-amber-600 ml-auto" />}
                </label>
              ))}
            </div>

            <button type="button" onClick={() => setStep(2)} className="mt-6 w-full rounded-xl bg-amber-600 py-3 font-semibold text-white hover:bg-amber-500">
              Next: Placard
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Placard & link</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Placard image (1200×630 recommended)</label>
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  id="promo-file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <label htmlFor="promo-file" className="cursor-pointer block">
                  {file ? (
                    <div>
                      <img src={URL.createObjectURL(file)} alt="Preview" className="mx-auto max-h-32 rounded-lg object-contain" />
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{file.name}</p>
                    </div>
                  ) : (
                    <div className="text-slate-500 dark:text-slate-400">
                      <ImagePlus className="mx-auto h-10 w-10" />
                      <p className="mt-2 text-sm">Upload your placard or sign image</p>
                      <p className="text-xs mt-1">We can help adjust it if needed.</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Where should the placard link to?</label>
              <div className="flex gap-4 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="linkType" checked={linkType === 'organization_page'} onChange={() => setLinkType('organization_page')} />
                  <span className="text-slate-700 dark:text-slate-300">My organization page</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="linkType" checked={linkType === 'external'} onChange={() => setLinkType('external')} />
                  <span className="text-slate-700 dark:text-slate-300">External website</span>
                </label>
              </div>
              {linkType === 'organization_page' && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Links to: /organization/{organization.username || 'your-org'}
                </p>
              )}
              {linkType === 'external' && (
                <input
                  type="url"
                  value={linkValue}
                  onChange={(e) => setLinkValue(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Message / event description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. event date, rally message, announcement..."
                rows={3}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 bg-white dark:bg-slate-800"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">We may adjust the placard design based on this.</p>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                Back
              </button>
              <button type="button" onClick={() => setStep(3)} className="flex-1 rounded-xl bg-amber-600 py-3 font-semibold text-white hover:bg-amber-500">
                Next: Pricing
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Plan & targeting</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Pick a package. Targeting (who sees it) is set by package—BASIC is everyone; TARGETED and PREMIUM let you choose.</p>

            <div className="space-y-4">
              {(['basic', 'targeted', 'premium'] as Tier[]).map((t) => (
                <div key={t} className={`rounded-xl border-2 p-4 ${tier === t ? 'border-amber-500 bg-amber-50/30 dark:bg-amber-900/20' : 'border-slate-200 dark:border-slate-600'}`}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="radio" name="tier" value={t} checked={tier === t} onChange={() => setTier(t)} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white">{TIER_LABELS[t]}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {t === 'basic' && 'Everyone in chosen areas · Up to 3 cities (20 mi radius), no demographic targeting'}
                        {t === 'targeted' && 'Target by language and location (up to 10 cities, 20 mi radius)'}
                        {t === 'premium' && 'Target by gender, age, language, and location (unlimited cities, 20 mi radius)'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {DURATION_OPTIONS.map((d) => (
                          <button
                            key={d.days}
                            type="button"
                            onClick={(e) => { e.preventDefault(); setDurationDays(d.days); }}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                              durationDays === d.days ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
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

            {tier === 'basic' && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 p-4 space-y-3">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Show to everyone in these areas (optional). Up to {MAX_CITIES_BASIC} cities, 20 mi radius each. No demographic targeting on BASIC.
                </p>
                <div className="relative" ref={citySearchWrapRef}>
                  <input
                    type="text"
                    value={citySearchQuery}
                    onChange={(e) => setCitySearchQuery(e.target.value)}
                    onFocus={() => citySearchQuery.trim().length >= 2 && setCitySearchOpen(true)}
                    placeholder="Search city..."
                    className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                  {citySearchOpen && (citySearchQuery.trim().length >= 2 || citySearchResults.length > 0) && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg max-h-48 overflow-y-auto">
                      {citySearchLoading ? (
                        <p className="px-3 py-2 text-xs text-slate-500">Searching...</p>
                      ) : citySearchResults.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-slate-500">No cities found.</p>
                      ) : (
                        citySearchResults.map((city, i) => (
                          <button key={`${city.label}-${i}`} type="button" onClick={() => addTargetCity(city)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                            <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                            {city.label}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {targetCities.map((city, i) => (
                      <span key={city.label + i} className="inline-flex items-center gap-1 rounded-full bg-slate-200 dark:bg-slate-600 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200">
                        {city.label} <span className="text-slate-500">(20 mi)</span>
                        <button type="button" onClick={() => removeTargetCity(i)} className="rounded p-0.5 hover:bg-slate-300 dark:hover:bg-slate-500" aria-label="Remove"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                  {targetCities.length >= MAX_CITIES_BASIC && <p className="mt-1 text-xs text-slate-500">Max {MAX_CITIES_BASIC} cities.</p>}
                </div>
              </div>
            )}

            {(tier === 'targeted' || tier === 'premium') && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/20 p-4 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Target className="h-4 w-4 text-amber-600" />
                  Who should see this?
                </h3>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Audience:</span>
                  <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm cursor-pointer">
                    <input type="radio" name="step3_audience" checked={audienceType === 'universal'} onChange={() => setAudienceType('universal')} className="sr-only" />
                    <span>Everyone</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm cursor-pointer">
                    <input type="radio" name="step3_audience" checked={audienceType === 'targeted'} onChange={() => setAudienceType('targeted')} className="sr-only" />
                    <span>Targeted</span>
                  </label>
                </div>
                <>
                    <div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Gender</p>
                      <div className="flex flex-wrap gap-1.5">
                        {GENDER_OPTIONS.map((opt) => (
                          <label key={opt.value} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs cursor-pointer ${genderOption === opt.value ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                            <input type="radio" name="step3_gender" value={opt.value} checked={genderOption === opt.value} onChange={() => setGenderOption(opt.value)} className="sr-only" />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Age groups</p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <label className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs cursor-pointer ${ageScope === 'all' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                          <input type="radio" name="step3_age_scope" checked={ageScope === 'all'} onChange={() => { setAgeScope('all'); setTargetAgeGroups([]); }} className="sr-only" />
                          <span>All ages</span>
                        </label>
                        <label className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs cursor-pointer ${ageScope === 'specific' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                          <input type="radio" name="step3_age_scope" checked={ageScope === 'specific'} onChange={() => setAgeScope('specific')} className="sr-only" />
                          <span>Select age groups</span>
                        </label>
                      </div>
                      {ageScope === 'specific' && (
                        <div className="flex flex-wrap gap-1.5">
                          {TARGET_AGE_GROUPS.map((a) => (
                            <label key={a} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
                              <input type="checkbox" checked={targetAgeGroups.includes(a)} onChange={() => setTargetAgeGroups((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]))} />
                              <span>{a}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Languages</p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <label className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs cursor-pointer ${languageScope === 'all' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                          <input type="radio" name="step3_lang_scope" checked={languageScope === 'all'} onChange={() => { setLanguageScope('all'); setTargetLanguages([]); setNewTargetLanguageInput(''); }} className="sr-only" />
                          <span>All languages</span>
                        </label>
                        <label className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs cursor-pointer ${languageScope === 'specific' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                          <input type="radio" name="step3_lang_scope" checked={languageScope === 'specific'} onChange={() => setLanguageScope('specific')} className="sr-only" />
                          <span>Select languages</span>
                        </label>
                      </div>
                      {languageScope === 'specific' && (
                        <>
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                            {spokenLanguagesWithDialects.slice(0, 12).map(({ code, label, flag }) => (
                              <label key={code} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-0.5 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
                                <input type="checkbox" checked={targetLanguages.includes(code)} onChange={() => setTargetLanguages((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]))} />
                                <span>{flag}</span>
                                <span>{label}</span>
                              </label>
                            ))}
                          </div>
                          <input type="text" value={newTargetLanguageInput} onChange={(e) => setNewTargetLanguageInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = newTargetLanguageInput.trim(); if (v && !targetLanguages.includes(v)) { setTargetLanguages((prev) => [...prev, v]); setNewTargetLanguageInput(''); } } }} placeholder="+ language code" className="mt-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs w-32 text-slate-900 dark:text-white" />
                        </>
                      )}
                    </div>
                    <div className="relative" ref={citySearchWrapRef}>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Locations (20 mi radius each{tier === 'premium' ? ', unlimited cities' : `, max ${MAX_CITIES_TARGETED} cities`})</p>
                      <input
                        type="text"
                        value={citySearchQuery}
                        onChange={(e) => setCitySearchQuery(e.target.value)}
                        onFocus={() => citySearchQuery.trim().length >= 2 && setCitySearchOpen(true)}
                        placeholder="Search city..."
                        className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                      />
                      {citySearchOpen && (citySearchQuery.trim().length >= 2 || citySearchResults.length > 0) && (
                        <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg max-h-48 overflow-y-auto">
                          {citySearchLoading ? (
                            <p className="px-3 py-2 text-xs text-slate-500">Searching...</p>
                          ) : citySearchResults.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-slate-500">No cities found. Try another search.</p>
                          ) : (
                            citySearchResults.map((city, i) => (
                              <button
                                key={`${city.label}-${i}`}
                                type="button"
                                onClick={() => addTargetCity(city)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                                {city.label}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {targetCities.map((city, i) => (
                          <span key={city.label + i} className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200">
                            {city.label} <span className="text-slate-500">(20 mi)</span>
                            <button type="button" onClick={() => removeTargetCity(i)} className="rounded p-0.5 hover:bg-amber-200 dark:hover:bg-amber-800" aria-label="Remove"><X className="h-3 w-3" /></button>
                          </span>
                        ))}
                      </div>
                      {tier !== 'premium' && targetCities.length >= maxCitiesForTier(tier) && <p className="mt-1 text-xs text-slate-500">Max {maxCitiesForTier(tier)} cities added.</p>}
                    </div>
                </>
              </div>
            )}

            <div className="rounded-xl bg-slate-100 dark:bg-slate-700 p-4 flex items-center justify-between">
              <span className="font-medium text-slate-900 dark:text-white">Total</span>
              <span className="text-xl font-bold text-amber-600">{priceDisplay}</span>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(2)} className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                Back
              </button>
              <button
                type="button"
                onClick={handlePayAndSubmit}
                disabled={submitting || targetCities.length === 0}
                className="flex-1 rounded-xl bg-amber-600 py-3 font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {submitting ? 'Redirecting to payment...' : targetCities.length === 0 ? 'Add at least one city' : 'Pay & submit'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
