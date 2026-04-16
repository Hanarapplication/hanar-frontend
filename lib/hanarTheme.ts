/**
 * Shared Hanar UI tokens for colors, surfaces, and icon styling.
 * Import where you want consistency without scattering magic strings.
 */
export const hanarTheme = {
  /** Solid polished blue wordmark */
  brandGradientText: 'text-blue-700 drop-shadow-[0_1px_0_rgba(255,255,255,0.35)] dark:text-blue-300',
  iconNav: 'text-slate-700',
  iconNavHover: 'hover:bg-slate-100',
  /** Icons inside white “chipped” header buttons (desktop) */
  iconHeaderChip: 'text-red-900 dark:text-red-950',
  card:
    'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900',
  inputFocusRing: 'focus-visible:ring-2 focus-visible:ring-blue-500/40',
} as const;
