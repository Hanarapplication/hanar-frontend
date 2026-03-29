'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AddressAutocomplete, { type AddressResult } from '@/components/AddressAutocomplete';
import { readSavedSearchRadiusMiles } from '@/lib/geoDistance';

export default function LocationPromptModal() {
  const [showModal, setShowModal] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [language, setLanguage] = useState<'en' | 'fa' | 'ar'>('en');

  // Detect user language
  useEffect(() => {
    const lang = navigator.language || navigator.languages?.[0];
    if (lang.startsWith('fa')) setLanguage('fa');
    else if (lang.startsWith('ar')) setLanguage('ar');
    else setLanguage('en');
  }, []);

  useEffect(() => {
    const seen = localStorage.getItem('hasSeenLocationPrompt');
    const coords = localStorage.getItem('userCoords');
    if (!seen && !coords) {
      setShowModal(true);
    }
  }, []);

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
          localStorage.setItem('hasSeenLocationPrompt', 'true');
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
          setShowModal(false);
        })();
      },
      () => {
        setShowFallback(true);
      }
    );
  };

  const handleAddressSelect = (result: AddressResult) => {
    const lat = result.lat ?? 0;
    const lng = result.lng ?? 0;
    if (lat === 0 && lng === 0) {
      alert(t('notFound'));
      return;
    }
    const coords = { lat, lon: lng };
    const cityValue = result.city || null;
    const stateValue = result.state || null;
    const zipValue = result.zip || null;
    const label = result.formatted_address || [result.city, result.state, result.zip].filter(Boolean).join(', ');
    localStorage.setItem('userCoords', JSON.stringify(coords));
    try { if (label) localStorage.setItem('userLocationLabel', label); } catch {}
    localStorage.setItem('hasSeenLocationPrompt', 'true');
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
    setShowModal(false);
  };

  const handleSkip = () => {
    setShowFallback(true);
  };

  const t = (key: string) => {
    const translations: Record<string, Record<'en' | 'fa' | 'ar', string>> = {
      allowTitle: {
        en: '📍 Allow Location Access',
        fa: '📍 اجازه دسترسی به موقعیت مکانی',
        ar: '📍 السماح بالوصول إلى الموقع',
      },
      allowText: {
        en: 'We use your location to show nearby businesses and marketplace items.',
        fa: 'ما از موقعیت مکانی شما برای نمایش کسب‌وکارهای نزدیک استفاده می‌کنیم.',
        ar: 'نستخدم موقعك لعرض الأنشطة التجارية القريبة.',
      },
      allowBtn: { en: 'Allow Location', fa: 'اجازه بده', ar: 'السماح' },
      notNow: { en: 'Not Now', fa: 'بعداً', ar: 'ليس الآن' },
      fallbackTitle: {
        en: '📍 Enter ZIP or City',
        fa: '📍 وارد کردن زیپ‌کد یا شهر',
        ar: '📍 أدخل الرمز البريدي أو المدينة',
      },
      fallbackText: {
        en: 'We’ll use this to show you nearby listings.',
        fa: 'از این برای نمایش آگهی‌های نزدیک استفاده می‌کنیم.',
        ar: 'سنستخدم هذا لعرض الإعلانات القريبة منك.',
      },
      inputPlaceholder: {
        en: 'ZIP code or City name',
        fa: 'زیپ‌کد یا نام شهر',
        ar: 'الرمز البريدي أو اسم المدينة',
      },
      submit: { en: 'Submit', fa: 'ثبت', ar: 'إرسال' },
      pleaseEnterZip: {
        en: 'Please enter a ZIP or city',
        fa: 'لطفاً زیپ‌کد یا شهر را وارد کنید',
        ar: 'يرجى إدخال الرمز البريدي أو المدينة',
      },
      notFound: {
        en: 'Could not find that location.',
        fa: 'موقعیت پیدا نشد.',
        ar: 'تعذر العثور على هذا الموقع.',
      },
      lookupFailed: {
        en: 'Failed to look up location.',
        fa: 'خطا در یافتن موقعیت.',
        ar: 'فشل في البحث عن الموقع.',
      },
    };

    return translations[key]?.[language] || translations[key]?.en || key;
  };

  if (!showModal) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-black/30 flex items-center justify-center p-4 transition-opacity animate-fade-in" role="dialog" aria-modal="true" aria-label="Location access">
      <div className="bg-white w-full max-w-sm rounded-xl shadow-xl p-5 text-center transform transition-all scale-95 animate-scale-in">
        {!showFallback ? (
          <>
            <h2 className="text-lg font-semibold mb-2">{t('allowTitle')}</h2>
            <p className="text-sm text-gray-600 mb-4">{t('allowText')}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleSkip}
                className="px-3 py-2 text-sm border border-gray-400 rounded-md"
              >
                {t('notNow')}
              </button>
              <button
                onClick={handleAllow}
                className="px-3 py-2 text-sm bg-green-600 text-white rounded-md"
              >
                {t('allowBtn')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold mb-2">{t('fallbackTitle')}</h2>
            <p className="text-sm text-gray-600 mb-4">{t('fallbackText')}</p>
            <AddressAutocomplete
              value=""
              onSelect={handleAddressSelect}
              placeholder={t('inputPlaceholder')}
              mode="locality"
              className="mb-3"
              inputClassName="w-full p-2 border rounded-md text-sm"
            />
            <p className="text-xs text-gray-500 mb-2">Search by city, ZIP, or address. Select a suggestion to save.</p>
          </>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
