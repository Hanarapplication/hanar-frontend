'use client';

import { createContext, useContext, useState, useEffect } from 'react';

type LanguageContextType = {
  lang: string;
  setLang: (lang: string) => void;
};

const LanguageContext = createContext<LanguageContextType>({
  lang: 'auto',
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState('auto');

  useEffect(() => {
    const savedLang = localStorage.getItem('hanarLang');
    if (savedLang) {
      setLang(savedLang);
    } else {
      const browserLang = navigator.language.slice(0, 2);
      setLang(browserLang);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('hanarLang', lang);
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
