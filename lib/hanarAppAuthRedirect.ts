import type { Session } from '@supabase/supabase-js';

/** sessionStorage key: user opened login (or will return via OAuth) from the Hanar native WebView. */
export const HANAR_LOGIN_FROM_APP_KEY = 'hanar_login_from_app';

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

export function hasHanarAppLoginIntent(): boolean {
  if (typeof window === 'undefined') return false;
  if (sessionStorage.getItem(HANAR_LOGIN_FROM_APP_KEY) === '1') return true;
  return new URLSearchParams(window.location.search).get('from') === 'app';
}

export function clearHanarAppLoginIntent(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(HANAR_LOGIN_FROM_APP_KEY);
}

export function redirectToHanarAppWithSession(session: Session): void {
  clearHanarAppLoginIntent();
  window.location.replace(buildHanarAuthDeepLink(session));
}
