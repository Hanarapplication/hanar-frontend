/**
 * Detects iOS WebView mode via query param ?app=ios.
 * Used to gate Stripe/checkout flows and show web-upgrade messaging in Flutter WebView.
 */
export function isAppIOS(searchOrParams?: URLSearchParams | string | null): boolean {
  if (searchOrParams == null) {
    if (typeof window === 'undefined') return false;
    searchOrParams = window.location.search;
  }
  const params = typeof searchOrParams === 'string'
    ? new URLSearchParams(searchOrParams)
    : searchOrParams;
  return params.get('app') === 'ios';
}

/**
 * Append ?app=ios to a URL when in iOS app mode.
 */
export function withAppParam(path: string, inAppMode: boolean): string {
  if (!inAppMode) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}app=ios`;
}
