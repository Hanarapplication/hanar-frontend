/**
 * Theme tokens for business profile. All templates use these; no per-template custom CSS.
 * Keys: background, cardBg, text, mutedText, primary, primaryText, border, shadow, radius.
 */

export const PROFILE_TEMPLATES = ['brand', 'sell', 'prestige', 'service', 'simple'] as const;
export type ProfileTemplateId = (typeof PROFILE_TEMPLATES)[number];

export const PROFILE_THEMES = ['classic', 'midnight', 'sunset', 'mint', 'rose', 'slate'] as const;
export type ProfileThemeId = (typeof PROFILE_THEMES)[number];

export interface ThemeTokens {
  background: string;
  cardBg: string;
  text: string;
  mutedText: string;
  primary: string;
  primaryText: string;
  border: string;
  shadow: string;
  radius: string;
}

const themes: Record<ProfileThemeId, ThemeTokens> = {
  classic: {
    background: '#ffffff',
    cardBg: '#ffffff',
    text: '#0f172a',
    mutedText: '#64748b',
    primary: '#2563eb',
    primaryText: '#ffffff',
    border: '#e2e8f0',
    shadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    radius: '0.75rem',
  },
  midnight: {
    background: '#0f172a',
    cardBg: '#1e293b',
    text: '#f8fafc',
    mutedText: '#94a3b8',
    primary: '#3b82f6',
    primaryText: '#ffffff',
    border: '#334155',
    shadow: '0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.2)',
    radius: '0.75rem',
  },
  sunset: {
    background: '#fff7ed',
    cardBg: '#ffffff',
    text: '#431407',
    mutedText: '#9a3412',
    primary: '#ea580c',
    primaryText: '#ffffff',
    border: '#fed7aa',
    shadow: '0 1px 3px 0 rgb(0 0 0 / 0.08)',
    radius: '0.75rem',
  },
  mint: {
    background: '#f0fdf4',
    cardBg: '#ffffff',
    text: '#14532d',
    mutedText: '#166534',
    primary: '#16a34a',
    primaryText: '#ffffff',
    border: '#bbf7d0',
    shadow: '0 1px 3px 0 rgb(0 0 0 / 0.08)',
    radius: '0.75rem',
  },
  rose: {
    background: '#fff1f2',
    cardBg: '#ffffff',
    text: '#4c0519',
    mutedText: '#9f1239',
    primary: '#e11d48',
    primaryText: '#ffffff',
    border: '#fecdd3',
    shadow: '0 1px 3px 0 rgb(0 0 0 / 0.08)',
    radius: '0.75rem',
  },
  slate: {
    background: '#f8fafc',
    cardBg: '#ffffff',
    text: '#0f172a',
    mutedText: '#475569',
    primary: '#475569',
    primaryText: '#ffffff',
    border: '#cbd5e1',
    shadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
    radius: '0.75rem',
  },
};

export function getThemeTokens(themeId: ProfileThemeId, accentOverride?: string | null): ThemeTokens {
  const t = themes[themeId] ?? themes.classic;
  if (accentOverride && /^#[0-9A-Fa-f]{6}$/.test(accentOverride)) {
    return { ...t, primary: accentOverride };
  }
  return t;
}

export function getThemeCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    '--bp-bg': tokens.background,
    '--bp-card-bg': tokens.cardBg,
    '--bp-text': tokens.text,
    '--bp-text-muted': tokens.mutedText,
    '--bp-primary': tokens.primary,
    '--bp-primary-text': tokens.primaryText,
    '--bp-border': tokens.border,
    '--bp-shadow': tokens.shadow,
    '--bp-radius': tokens.radius,
  } as Record<string, string>;
}
