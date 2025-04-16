'use client';

import { useEffect, useState } from 'react';

export default function LocationPromptModal() {
  const [showModal, setShowModal] = useState(false);
  const [zipCity, setZipCity] = useState('');
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

  const handleAllow = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        };
        localStorage.setItem('userCoords', JSON.stringify(coords));
        localStorage.setItem('hasSeenLocationPrompt', 'true');
        setShowModal(false);
      },
      () => {
        setShowFallback(true);
      }
    );
  };

  const handleZipSubmit = async () => {
    if (!zipCity) return alert(t('pleaseEnterZip'));
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(zipCity)}`
      );
      const data = await res.json();
      if (data.length > 0) {
        const coords = {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
        };
        localStorage.setItem('userCoords', JSON.stringify(coords));
        localStorage.setItem('hasSeenLocationPrompt', 'true');
        setShowModal(false);
      } else {
        alert(t('notFound'));
      }
    } catch {
      alert(t('lookupFailed'));
    }
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

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center transition-opacity animate-fade-in">
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
            <input
              type="text"
              placeholder={t('inputPlaceholder')}
              value={zipCity}
              onChange={(e) => setZipCity(e.target.value)}
              className="w-full p-2 mb-3 border rounded-md text-sm"
            />
            <button
              onClick={handleZipSubmit}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-md"
            >
              {t('submit')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
