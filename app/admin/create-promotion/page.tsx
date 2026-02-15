'use client';

import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, ImagePlus, Home, Users, Globe, Check, Target, MapPin, X, Megaphone } from 'lucide-react';
import { spokenLanguagesWithDialects } from '@/utils/languages';

type Placement = 'home_feed' | 'community' | 'universal';
type LinkType = 'business_page' | 'organization_page' | 'external';
type Tier = 'basic' | 'targeted' | 'premium';
type AudienceType = 'universal' | 'targeted';

const MAX_CITIES_BASIC = 3;
const MAX_CITIES_TARGETED = 10;
const MAX_CITIES_PREMIUM = 100;
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

type BusinessRow = { id: string; business_name: string; slug: string };
type OrgRow = { id: string; full_name: string; username: string | null };

function AdminCreatePromotionContent() {
  const [source, setSource] = useState<'business' | 'organization'>('business');
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [organizations, setOrganizations] = useState<OrgRow[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessRow | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrgRow | null>(null);
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
  const [linkType, setLinkType] = useState<LinkType>('business_page');
  const [linkValue, setLinkValue] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [tier, setTier] = useState<Tier>('basic');
  const [durationDays, setDurationDays] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [entitySearchQuery, setEntitySearchQuery] = useState('');
  const [entitySearchOpen, setEntitySearchOpen] = useState(false);
  const entitySearchWrapRef = useRef<HTMLDivElement>(null);

  // Filter businesses and orgs by search query (client-side)
  const entitySearchResults = (() => {
    const q = entitySearchQuery.trim().toLowerCase();
    if (!q) return [];
    const bizMatches = businesses
      .filter((b) => b.business_name?.toLowerCase().includes(q) || (b.slug || '').toLowerCase().includes(q))
      .map((b) => ({ type: 'business' as const, ...b }));
    const orgMatches = organizations
      .filter((o) => o.full_name?.toLowerCase().includes(q) || (o.username || '').toLowerCase().includes(q))
      .map((o) => ({ type: 'organization' as const, ...o }));
    return [...bizMatches.slice(0, 15), ...orgMatches.slice(0, 15)];
  })();

  useEffect(() => {
    const load = async () => {
      try {
        const [bizRes, orgRes] = await Promise.all([
          fetch('/api/admin/businesses', { credentials: 'include' }),
          fetch('/api/admin/organizations', { credentials: 'include' }),
        ]);
        const bizData = await bizRes.json().catch(() => ({}));
        const orgData = await orgRes.json().catch(() => ({}));
        if (bizRes.ok && Array.isArray(bizData.businesses)) setBusinesses(bizData.businesses);
        if (orgRes.ok && Array.isArray(orgData.organizations)) setOrganizations(orgData.organizations);
      } catch {
        toast.error('Failed to load businesses/organizations');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    setLinkType(source === 'organization' ? 'organization_page' : 'business_page');
  }, [source]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (entitySearchWrapRef.current && !entitySearchWrapRef.current.contains(e.target as Node)) {
        setEntitySearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const selectEntity = (item: (BusinessRow & { type: 'business' }) | (OrgRow & { type: 'organization' })) => {
    if (item.type === 'business') {
      setSource('business');
      setSelectedBusiness(item);
      setSelectedOrg(null);
    } else {
      setSource('organization');
      setSelectedOrg(item);
      setSelectedBusiness(null);
    }
    setEntitySearchQuery(item.type === 'business' ? (item as BusinessRow).business_name : (item as OrgRow).full_name);
    setEntitySearchOpen(false);
  };

  const clearEntity = () => {
    setSelectedBusiness(null);
    setSelectedOrg(null);
    setEntitySearchQuery('');
    setEntitySearchOpen(false);
  };

  useEffect(() => {
    const max = maxCitiesForTier(tier);
    setTargetCities((prev) => (prev.length <= max ? prev : prev.slice(0, max)));
  }, [tier]);

  const entity = source === 'business' ? selectedBusiness : selectedOrg;
  const slug = source === 'business' ? (selectedBusiness?.slug ?? '') : (selectedOrg?.username ?? '');

  const handleSubmit = async () => {
    if (!entity) {
      toast.error('Please select a business or organization');
      return;
    }
    if (targetCities.length === 0) {
      toast.error('Please add at least one city to continue');
      return;
    }
    if (linkType === 'external' && !linkValue.trim()) {
      toast.error('Enter website or external link');
      return;
    }
    if (!file) {
      toast.error('Please upload a banner image');
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set('source', source);
      if (source === 'business') form.set('business_id', (entity as BusinessRow).id);
      else form.set('organization_id', (entity as OrgRow).id);
      form.set('placement', placement);

      const isBasic = tier === 'basic';
      const isTargetedOrPremium = tier === 'targeted' || tier === 'premium';
      const basicWithCities = isBasic && targetCities.length > 0;
      const effectiveAudience = basicWithCities ? 'targeted' : (isTargetedOrPremium ? audienceType : 'universal');
      form.set('audience_type', effectiveAudience);

      if (targetCities.length > 0) {
        const locs =
          tier === 'basic'
            ? targetCities.slice(0, MAX_CITIES_BASIC)
            : tier === 'targeted'
              ? targetCities.slice(0, MAX_CITIES_TARGETED)
              : targetCities;
        form.set('target_locations', JSON.stringify(locs.map((c) => c.label)));
        form.set('target_location_coords', JSON.stringify(locs.map((c) => ({ label: c.label, lat: c.lat, lng: c.lng }))));
      }
      if (effectiveAudience === 'targeted') {
        if (isTargetedOrPremium) {
          if (targetLanguages.length) form.set('target_languages', JSON.stringify(targetLanguages));
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
      form.set('image', file);

      const res = await fetch('/api/admin/create-promotion', {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || res.statusText || 'Create failed');
      toast.success('Promotion created and live in the feed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-500">Loading businesses and organizations...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/admin/dashboard"
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
          <Megaphone className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Create Promotion (Admin)</h1>
          <p className="text-sm text-slate-500">
            Same as business promotion requests, but no payment. Promotion is created and approved immediately.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" ref={entitySearchWrapRef}>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Select business or organization</h2>
        <div className="relative">
          <input
            type="text"
            value={entity ? (source === 'business' ? (entity as BusinessRow).business_name : (entity as OrgRow).full_name) : entitySearchQuery}
            onChange={(e) => {
              const v = e.target.value;
              if (entity) clearEntity();
              setEntitySearchQuery(v);
              setEntitySearchOpen(v.length >= 1);
            }}
            onFocus={() => {
              if (entitySearchQuery.trim().length >= 1 || !entity) setEntitySearchOpen(true);
            }}
            placeholder="Search by business or organization name..."
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 pr-10 text-slate-900 placeholder:text-slate-400 bg-white"
            autoComplete="off"
          />
          {entity && (
            <button
              type="button"
              onClick={clearEntity}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {entitySearchOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-60 overflow-y-auto">
              {entitySearchQuery.trim().length < 1 ? (
                <p className="px-4 py-3 text-sm text-slate-500">Type to search businesses and organizations</p>
              ) : entitySearchResults.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-500">No matches found</p>
              ) : (
                entitySearchResults.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    onClick={() => selectEntity(item)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                  >
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                        item.type === 'business' ? 'bg-amber-100 text-amber-800' : 'bg-violet-100 text-violet-800'
                      }`}
                    >
                      {item.type === 'business' ? 'Business' : 'Org'}
                    </span>
                    <span className="font-medium">
                      {item.type === 'business' ? (item as BusinessRow).business_name : (item as OrgRow).full_name}
                    </span>
                    <span className="text-slate-400 truncate">
                      {item.type === 'business' ? (item as BusinessRow).slug : (item as OrgRow).username || ''}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              step === s ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
          >
            {s === 1 ? 'Placement' : s === 2 ? 'Creative' : 'Targeting'}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Where should the banner show?</h2>
          <div className="space-y-3">
            {PLACEMENTS.map((p) => (
              <label
                key={p.value}
                className={`flex items-center gap-4 rounded-xl border-2 p-4 cursor-pointer transition ${
                  placement === p.value ? 'border-amber-500 bg-amber-50/50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="placement"
                  value={p.value}
                  checked={placement === p.value}
                  onChange={() => setPlacement(p.value)}
                  className="sr-only"
                />
                <span className="text-amber-600">{p.icon}</span>
                <div>
                  <p className="font-medium text-slate-900">{p.label}</p>
                  <p className="text-sm text-slate-500">{p.desc}</p>
                </div>
                {placement === p.value && <Check className="h-5 w-5 text-amber-600 ml-auto" />}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mt-6 w-full rounded-xl bg-amber-600 py-3 font-semibold text-white hover:bg-amber-500"
          >
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
                    <p className="mt-2 text-sm">Upload banner</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Where should the banner link to?</label>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="linkType"
                  checked={linkType === (source === 'organization' ? 'organization_page' : 'business_page')}
                  onChange={() => setLinkType(source === 'organization' ? 'organization_page' : 'business_page')}
                />
                <span>{source === 'organization' ? 'Organization page' : 'Business page'}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="linkType" checked={linkType === 'external'} onChange={() => setLinkType('external')} />
                <span>External website</span>
              </label>
            </div>
            {(linkType === 'business_page' || linkType === 'organization_page') && (
              <p className="text-sm text-slate-500">
                Links to: {source === 'organization' ? `/organization/${slug}` : `/business/${slug}`}
              </p>
            )}
            {linkType === 'external' && (
              <input
                type="url"
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 mt-2"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description / slogan</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. slogan, special offer..."
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 rounded-xl bg-amber-600 py-3 font-semibold text-white hover:bg-amber-500"
            >
              Next: Targeting
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-slate-900">Plan & targeting</h2>

          <div className="space-y-4">
            {(['basic', 'targeted', 'premium'] as Tier[]).map((t) => (
              <div key={t} className={`rounded-xl border-2 p-4 ${tier === t ? 'border-amber-500 bg-amber-50/30' : 'border-slate-200'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="tier" value={t} checked={tier === t} onChange={() => setTier(t)} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{TIER_LABELS[t]}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t === 'basic' && 'Up to 3 cities, 20 mi radius'}
                      {t === 'targeted' && 'Up to 10 cities, language targeting'}
                      {t === 'premium' && 'Unlimited cities, gender, age, language'}
                    </p>
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
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </label>
              </div>
            ))}
          </div>

          {tier === 'basic' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <p className="text-sm text-slate-700">Up to {MAX_CITIES_BASIC} cities, 20 mi radius each.</p>
              <div className="relative" ref={citySearchWrapRef}>
                <input
                  type="text"
                  value={citySearchQuery}
                  onChange={(e) => setCitySearchQuery(e.target.value)}
                  onFocus={() => citySearchQuery.trim().length >= 2 && setCitySearchOpen(true)}
                  placeholder="Search city..."
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                />
                {citySearchOpen && (citySearchQuery.trim().length >= 2 || citySearchResults.length > 0) && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                    {citySearchLoading ? (
                      <p className="px-3 py-2 text-xs text-slate-500">Searching...</p>
                    ) : citySearchResults.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-500">No cities found.</p>
                    ) : (
                      citySearchResults.map((city, i) => (
                        <button
                          key={`${city.label}-${i}`}
                          type="button"
                          onClick={() => addTargetCity(city)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
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
                    <span
                      key={city.label + i}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-xs text-slate-800"
                    >
                      {city.label} <span className="text-slate-500">(20 mi)</span>
                      <button
                        type="button"
                        onClick={() => removeTargetCity(i)}
                        className="rounded p-0.5 hover:bg-slate-300"
                        aria-label="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(tier === 'targeted' || tier === 'premium') && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-600" />
                Who should see this?
              </h3>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm cursor-pointer">
                  <input type="radio" name="audience" checked={audienceType === 'universal'} onChange={() => setAudienceType('universal')} className="sr-only" />
                  <span>Everyone</span>
                </label>
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm cursor-pointer">
                  <input type="radio" name="audience" checked={audienceType === 'targeted'} onChange={() => setAudienceType('targeted')} className="sr-only" />
                  <span>Targeted</span>
                </label>
              </div>
              {tier === 'premium' && (
                <>
                  <div>
                    <p className="text-xs font-medium text-slate-700 mb-1.5">Gender</p>
                    <div className="flex flex-wrap gap-1.5">
                      {GENDER_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs cursor-pointer ${
                            genderOption === opt.value ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name="gender"
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
                    <p className="text-xs font-medium text-slate-700 mb-1.5">Age groups</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <label
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs cursor-pointer ${
                          ageScope === 'all' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <input type="radio" name="ageScope" checked={ageScope === 'all'} onChange={() => { setAgeScope('all'); setTargetAgeGroups([]); }} className="sr-only" />
                        <span>All ages</span>
                      </label>
                      <label
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs cursor-pointer ${
                          ageScope === 'specific' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <input type="radio" name="ageScope" checked={ageScope === 'specific'} onChange={() => setAgeScope('specific')} className="sr-only" />
                        <span>Select age groups</span>
                      </label>
                    </div>
                    {ageScope === 'specific' && (
                      <div className="flex flex-wrap gap-1.5">
                        {TARGET_AGE_GROUPS.map((a) => (
                          <label
                            key={a}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs cursor-pointer hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={targetAgeGroups.includes(a)}
                              onChange={() =>
                                setTargetAgeGroups((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]))
                              }
                            />
                            <span>{a}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
              <div>
                <p className="text-xs font-medium text-slate-700 mb-1.5">Languages</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <label
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs cursor-pointer ${
                      languageScope === 'all' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="langScope"
                      checked={languageScope === 'all'}
                      onChange={() => { setLanguageScope('all'); setTargetLanguages([]); setNewTargetLanguageInput(''); }}
                      className="sr-only"
                    />
                    <span>All languages</span>
                  </label>
                  <label
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs cursor-pointer ${
                      languageScope === 'specific' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input type="radio" name="langScope" checked={languageScope === 'specific'} onChange={() => setLanguageScope('specific')} className="sr-only" />
                    <span>Select languages</span>
                  </label>
                </div>
                {languageScope === 'specific' && (
                  <>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {spokenLanguagesWithDialects.slice(0, 12).map(({ code, label, flag }) => (
                        <label
                          key={code}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs cursor-pointer hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={targetLanguages.includes(code)}
                            onChange={() =>
                              setTargetLanguages((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]))
                            }
                          />
                          <span>{flag}</span>
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
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
                      placeholder="+ language code"
                      className="mt-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs w-32"
                    />
                  </>
                )}
              </div>
              <div className="relative" ref={citySearchWrapRef}>
                <p className="text-xs font-medium text-slate-700 mb-1.5">
                  Locations (20 mi radius each{tier === 'premium' ? ', unlimited cities' : `, max ${MAX_CITIES_TARGETED}`})
                </p>
                <input
                  type="text"
                  value={citySearchQuery}
                  onChange={(e) => setCitySearchQuery(e.target.value)}
                  onFocus={() => citySearchQuery.trim().length >= 2 && setCitySearchOpen(true)}
                  placeholder="Search city..."
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                />
                {citySearchOpen && (citySearchQuery.trim().length >= 2 || citySearchResults.length > 0) && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                    {citySearchLoading ? (
                      <p className="px-3 py-2 text-xs text-slate-500">Searching...</p>
                    ) : citySearchResults.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-500">No cities found.</p>
                    ) : (
                      citySearchResults.map((city, i) => (
                        <button
                          key={`${city.label}-${i}`}
                          type="button"
                          onClick={() => addTargetCity(city)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
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
                    <span
                      key={city.label + i}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs text-slate-800"
                    >
                      {city.label} <span className="text-slate-500">(20 mi)</span>
                      <button type="button" onClick={() => removeTargetCity(i)} className="rounded p-0.5 hover:bg-amber-200" aria-label="Remove">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            <strong>No payment.</strong> Admin-created promotions are free and go live immediately.
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || targetCities.length === 0 || !file || !entity}
              className="flex-1 rounded-xl bg-amber-600 py-3 font-semibold text-white hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : targetCities.length === 0 ? 'Add at least one city' : !file ? 'Upload banner' : !entity ? 'Select entity' : 'Create promotion'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminCreatePromotionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12">Loading...</div>}>
      <AdminCreatePromotionContent />
    </Suspense>
  );
}
