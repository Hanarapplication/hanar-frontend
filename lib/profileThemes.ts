/**
 * Profile page theme IDs. Used in DB (businesses.profile_theme) and in UI.
 * Paid businesses choose from themes allowed by their plan.
 */
export const PROFILE_THEMES = ['default', 'modern', 'minimal', 'premium'] as const;
export type ProfileThemeId = (typeof PROFILE_THEMES)[number];

export interface ProfileThemeOption {
  id: ProfileThemeId;
  name: string;
  description: string;
}

export const PROFILE_THEME_OPTIONS: ProfileThemeOption[] = [
  { id: 'default', name: 'Default', description: 'Clean single card with hours and contact.' },
  { id: 'modern', name: 'Modern', description: 'Bold header and card-based sections.' },
  { id: 'minimal', name: 'Minimal', description: 'Minimal layout with focus on content.' },
  { id: 'premium', name: 'Premium', description: 'Full-width hero and premium styling.' },
];

/** Plan tier order (free = 0, premium = 3). */
const PLAN_ORDER: Record<string, number> = {
  free: 0,
  starter: 1,
  growth: 2,
  premium: 3,
};

/**
 * Which profile themes each plan can use.
 * Free: default only. Starter: default + modern. Growth: + minimal. Premium: all.
 */
export function getAllowedProfileThemes(plan: string | null | undefined): ProfileThemeId[] {
  const tier = PLAN_ORDER[String(plan || 'free').toLowerCase()] ?? 0;
  if (tier >= 3) return [...PROFILE_THEMES];
  if (tier >= 2) return ['default', 'modern', 'minimal'];
  if (tier >= 1) return ['default', 'modern'];
  return ['default'];
}

export function canUseProfileTheme(plan: string | null | undefined, themeId: ProfileThemeId): boolean {
  return getAllowedProfileThemes(plan).includes(themeId);
}

/** Normalize stored theme; fallback to 'default' if invalid or not allowed for plan. */
export function resolveProfileTheme(
  stored: string | null | undefined,
  plan: string | null | undefined
): ProfileThemeId {
  const id = (stored || 'default').toLowerCase() as ProfileThemeId;
  if (PROFILE_THEMES.includes(id) && canUseProfileTheme(plan, id)) return id;
  return 'default';
}
