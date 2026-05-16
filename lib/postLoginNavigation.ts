/**
 * Shared post-login URLs: same-origin redirect param, then account-type routes.
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

export function resolvePostLoginHref(
  redirectParam: string | null,
  userType: PostLoginUserType,
): string {
  const next = safeInternalRedirectPath(redirectParam);
  if (next) return next;
  if (userType === 'business') return '/business-dashboard';
  if (userType === 'organization') return '/organization/dashboard';
  return '/dashboard';
}
