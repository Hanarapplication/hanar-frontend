/**
 * Shared post-login URLs: same-origin `redirect` param when present, otherwise home feed.
 * Prefer `window.location.assign` after password/OAuth sign-in so in-app WebViews
 * reliably leave `/login` (client `router.replace` can appear as a no-op).
 */

/** Same-origin path only — blocks `//evil.com` open redirects */
export function safeInternalRedirectPath(raw: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  if (trimmed.includes('://')) return null;
  return trimmed;
}

export type PostLoginUserType = 'business' | 'individual' | 'organization';

/** Account dashboards — post-login always sends users to the home feed instead. */
const DASHBOARD_POST_LOGIN_PREFIXES = ['/dashboard', '/business-dashboard', '/organization/dashboard'] as const;

function isDashboardPostLoginPath(path: string): boolean {
  const base = path.split('?')[0]?.split('#')[0]?.replace(/\/$/, '') || '/';
  return DASHBOARD_POST_LOGIN_PREFIXES.some((prefix) => base === prefix || base.startsWith(`${prefix}/`));
}

/**
 * Where to send the user after sign-in. Defaults to home feed (`/`).
 * Honors safe `redirect` params except dashboard URLs (those become `/`).
 */
export function resolvePostLoginHref(
  redirectParam: string | null,
  _userType?: PostLoginUserType,
): string {
  const next = safeInternalRedirectPath(redirectParam);
  if (next && !isDashboardPostLoginPath(next)) return next;
  return '/';
}
