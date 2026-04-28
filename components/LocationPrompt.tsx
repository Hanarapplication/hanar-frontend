'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AddressAutocomplete, { type AddressResult } from '@/components/AddressAutocomplete';
import { readSavedSearchRadiusMiles } from '@/lib/geoDistance';
import { useLanguage } from '@/context/LanguageContext';
import { supportedLanguages } from '@/utils/languages';
import { t } from '@/utils/translations';

const ONBOARDING_DONE_KEY = 'hanarOnboardingDone';
const LEGACY_LOCATION_SEEN_KEY = 'hasSeenLocationPrompt';

type OnboardingStep = 'language' | 'locationPrompt' | 'manualLocation';

export default function LocationPromptModal() {
  const { setLang, effectiveLang } = useLanguage();
  const pathname = usePathname() ?? '';
  const [showModal, setShowModal] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [step, setStep] = useState<OnboardingStep>('language');
  const [selectedLang, setSelectedLang] = useState('en');

  useEffect(() => {
    const bootstrapPrompt = async () => {
      // Only allow onboarding prompt on feed pages, never while browsing detail/list pages.
      const shouldRenderOnRoute = pathname === '/' || pathname === '/home-feed';
      if (!shouldRenderOnRoute) {
        setShowModal(false);
        setInitialized(true);
        return;
      }

      const savedLang = localStorage.getItem('hanarLang');
      if (savedLang && savedLang !== 'auto') {
        setSelectedLang(savedLang);
      } else {
        const browserLang = (navigator.language || navigator.languages?.[0] || 'en').slice(0, 2).toLowerCase();
        const supportedCodes = new Set(
          supportedLanguages
            .map((entry) => entry.code)
            .filter((code) => code !== 'auto')
        );
        setSelectedLang(supportedCodes.has(browserLang) ? browserLang : 'en');
      }

      // Never show onboarding location/language prompt to logged-in users.
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setShowModal(false);
        setInitialized(true);
        return;
      }

      const isDone = localStorage.getItem(ONBOARDING_DONE_KEY) === 'true';
      const savedCoords = localStorage.getItem('userCoords');
      const currentLang = localStorage.getItem('hanarLang');
      const hasChosenLang = !!currentLang && currentLang !== 'auto';
      const hasLocation = !!savedCoords;
      const shouldShow = !isDone || !hasChosenLang || !hasLocation;
      setShowModal(shouldShow);
      if (shouldShow) setStep('language');
      setInitialized(true);
    };

    void bootstrapPrompt();
  }, [pathname]);

  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDING_DONE_KEY, 'true');
    localStorage.setItem(LEGACY_LOCATION_SEEN_KEY, 'true');
    setShowModal(false);
  };

  const persistLocation = async (
    lat: number,
    lon: number,
    meta?: { city?: string | null; state?: string | null; zip?: string | null; source?: string }
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || '';
      await fetch('/api/user-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          lat,
          lng: lon,
          city: meta?.city ?? null,
          state: meta?.state ?? null,
          zip: meta?.zip ?? null,
          source: meta?.source ?? null,
        }),
      });
    } catch {
      // Ignore persistence failures
    }
  };

  const handleAllow = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void (async () => {
          const coords = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          };
          localStorage.setItem('userCoords', JSON.stringify(coords));
          void persistLocation(coords.lat, coords.lon, { source: 'gps' });

          const radiusMiles = readSavedSearchRadiusMiles(40);
          let label: string | undefined;
          try {
            const res = await fetch(
              `/api/geocode/reverse?lat=${encodeURIComponent(coords.lat)}&lon=${encodeURIComponent(coords.lon)}`
            );
            const data = await res.json();
            const city =
              data.address?.city ||
              data.address?.town ||
              data.address?.village ||
              data.address?.state ||
              data.display_name;
            if (city) {
              label = String(city);
              localStorage.setItem('userLocationLabel', label);
            }
          } catch {
            /* optional label */
          }

          window.dispatchEvent(
            new CustomEvent('location:updated', {
              detail: { ...coords, label, radiusMiles, source: 'gps' },
            })
          );
          completeOnboarding();
        })();
      },
      () => {
        setStep('manualLocation');
      }
    );
  };

  const handleAddressSelect = (result: AddressResult) => {
    const lat = result.lat ?? 0;
    const lng = result.lng ?? 0;
    if (lat === 0 && lng === 0) {
      alert(t(effectiveLang, 'Could not find that location.'));
      return;
    }
    const coords = { lat, lon: lng };
    const cityValue = result.city || null;
    const stateValue = result.state || null;
    const zipValue = result.zip || null;
    const label = result.formatted_address || [result.city, result.state, result.zip].filter(Boolean).join(', ');
    localStorage.setItem('userCoords', JSON.stringify(coords));
    try { if (label) localStorage.setItem('userLocationLabel', label); } catch {}
    persistLocation(coords.lat, coords.lon, {
      city: cityValue,
      state: stateValue,
      zip: zipValue,
      source: 'google_places',
    });
    if (typeof window !== 'undefined') {
      const radiusMiles = readSavedSearchRadiusMiles(40);
      window.dispatchEvent(new CustomEvent('location:updated', {
        detail: {
          ...coords,
          label,
          city: cityValue,
          state: stateValue,
          zip: zipValue,
          radiusMiles,
          source: 'google_places',
        },
      }));
    }
    completeOnboarding();
  };

  const handleContinueLanguage = () => {
    localStorage.setItem('hanarLang', selectedLang);
    setLang(selectedLang);
    setStep('locationPrompt');
  };

  if (!initialized || !showModal) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] pointer-events-none bg-black/30 flex items-center justify-center p-4 transition-opacity animate-fade-in" role="dialog" aria-modal="true" aria-label={t(effectiveLang, 'Onboarding')}>
      <div className="pointer-events-auto bg-white w-full max-w-sm rounded-xl shadow-xl p-5 text-center transform transition-all scale-95 animate-scale-in">
        {step === 'language' && (
          <>
            <h2 className="text-lg font-semibold mb-2">{t(effectiveLang, 'Choose your language')}</h2>
            <p className="text-sm text-gray-600 mb-4">
              {t(effectiveLang, 'Pick your app language to start Hanar in your preferred language.')}
            </p>
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {supportedLanguages
                .filter((entry) => entry.code !== 'auto')
                .map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.emoji} {entry.name}
                  </option>
                ))}
            </select>
            <div className="flex justify-center">
              <button
                onClick={handleContinueLanguage}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md"
              >
                {t(effectiveLang, 'Continue')}
              </button>
            </div>
          </>
        )}

        {step === 'locationPrompt' && (
          <>
            <h2 className="text-lg font-semibold mb-2">{t(effectiveLang, 'Allow Location Access')}</h2>
            <p className="text-sm text-gray-600 mb-4">
              {t(effectiveLang, 'We use your location to show nearby businesses and marketplace items.')}
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setStep('manualLocation')}
                className="px-3 py-2 text-sm border border-gray-400 rounded-md"
              >
                {t(effectiveLang, 'Enter ZIP or city')}
              </button>
              <button onClick={handleAllow} className="px-3 py-2 text-sm bg-green-600 text-white rounded-md">
                {t(effectiveLang, 'Allow Location')}
              </button>
            </div>
          </>
        )}

        {step === 'manualLocation' && (
          <>
            <h2 className="text-lg font-semibold mb-2">{t(effectiveLang, 'Enter ZIP or City')}</h2>
            <p className="text-sm text-gray-600 mb-4">{t(effectiveLang, "We'll use this to show you nearby listings.")}</p>
            <AddressAutocomplete
              value=""
              onSelect={handleAddressSelect}
              placeholder={t(effectiveLang, 'ZIP code or City name')}
              mode="locality"
              className="mb-3"
              inputClassName="w-full p-2 border rounded-md text-sm"
            />
            <p className="text-xs text-gray-500 mb-2">{t(effectiveLang, 'Search by city, ZIP, or address. Select a suggestion to save.')}</p>
          </>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
