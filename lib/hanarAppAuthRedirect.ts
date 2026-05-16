import type { Session } from '@supabase/supabase-js';

/** sessionStorage key: user opened login (or will return via OAuth) from the Hanar native WebView. */
export const HANAR_LOGIN_FROM_APP_KEY = 'hanar_login_from_app';

/**
 * Flutter can append this substring to the WebView user agent so any route
 * (including `/login?redirect=/`) triggers post-login `hanar://auth` without query params.
 * Example (dart): `..setUserAgent('${await controller.getUserAgent()} HanarNativeApp')`
 */
const HANAR_APP_USER_AGENT = /HanarNativeApp/i;

function urlSearchIndicatesHanarApp(params: URLSearchParams): boolean {
  if (params.get('from') === 'app') return true;
  // Flutter initial URL often uses ?platform=app (see HanarWebViewScreen _startUri).
  if (params.get('platform') === 'app') return true;
  const app = params.get('app');
  if (app === '1' || app === 'true') return true;
  if (params.get('hanar_client') === 'app') return true;
  if (params.get('hanar_app') === '1') return true;
  return false;
}

/**
 * Deep link consumed by the Flutter shell (_parseAuthUri): scheme hanar, host auth,
 * query must include access_token; refresh_token and expires_in are included for Supabase.
 */
export function buildHanarAuthDeepLink(session: Session): string {
  const access = session.access_token;
  const refresh = session.refresh_token ?? '';
  let expiresIn = session.expires_in;
  if (expiresIn == null && session.expires_at != null) {
    expiresIn = Math.max(0, session.expires_at - Math.floor(Date.now() / 1000));
  }
  if (expiresIn == null) {
    expiresIn = 3600;
  }
  const q = new URLSearchParams();
  q.set('access_token', access);
  if (refresh) q.set('refresh_token', refresh);
  q.set('expires_in', String(expiresIn));
  return `hanar://auth?${q.toString()}`;
}

export function markHanarAppLoginIntent(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(HANAR_LOGIN_FROM_APP_KEY, '1');
}

/** Call on load and on client navigations so `?from=app` on home persists across in-app links to `/login`. */
export function syncHanarAppIntentFromBrowser(): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (urlSearchIndicatesHanarApp(params)) {
    markHanarAppLoginIntent();
    return;
  }
  if (typeof navigator !== 'undefined' && HANAR_APP_USER_AGENT.test(navigator.userAgent)) {
    markHanarAppLoginIntent();
  }
}

function isHanarNativeUserAgent(): boolean {
  return typeof navigator !== 'undefined' && HANAR_APP_USER_AGENT.test(navigator.userAgent);
}

/**
 * True when post-login should deep-link into the native shell (`hanar://auth`).
 * SessionStorage alone does not count — visiting `/?platform=app` in mobile Safari once
 * would otherwise make the first browser login attempt a no-op `hanar://` redirect.
 */
export function hasHanarAppLoginIntent(): boolean {
  if (typeof window === 'undefined') return false;
  if (urlSearchIndicatesHanarApp(new URLSearchParams(window.location.search))) return true;
  if (!isHanarNativeUserAgent()) return false;
  if (sessionStorage.getItem(HANAR_LOGIN_FROM_APP_KEY) === '1') return true;
  return true;
}

export function clearHanarAppLoginIntent(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(HANAR_LOGIN_FROM_APP_KEY);
}

export function redirectToHanarAppWithSession(session: Session): void {
  clearHanarAppLoginIntent();
  // `href` assignment tends to be more reliable than `replace` for custom schemes from Android WebView.
  window.location.href = buildHanarAuthDeepLink(session);
}
