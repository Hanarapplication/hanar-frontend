'use client';

import { createContext, useContext, useMemo } from 'react';
import { getThemeTokens, getThemeCssVars, type ProfileThemeId, type ThemeTokens } from './tokens';

const BusinessProfileThemeContext = createContext<ThemeTokens | null>(null);

export function useBusinessProfileTheme(): ThemeTokens {
  const ctx = useContext(BusinessProfileThemeContext);
  if (!ctx) {
    return getThemeTokens('classic');
  }
  return ctx;
}

interface BusinessProfileThemeProviderProps {
  themeId: ProfileThemeId;
  accentColor?: string | null;
  children: React.ReactNode;
}

export function BusinessProfileThemeProvider({
  themeId,
  accentColor,
  children,
}: BusinessProfileThemeProviderProps) {
  const tokens = useMemo(
    () => getThemeTokens(themeId, accentColor),
    [themeId, accentColor]
  );
  const style = useMemo(() => getThemeCssVars(tokens), [tokens]);

  return (
    <BusinessProfileThemeContext.Provider value={tokens}>
      <div
        className="min-h-screen font-inter"
        style={style as React.CSSProperties}
      >
        {children}
      </div>
    </BusinessProfileThemeContext.Provider>
  );
}
