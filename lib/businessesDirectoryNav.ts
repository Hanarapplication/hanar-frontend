/** When user opens /businesses from a business slug header, navbar back should go to home feed. */
const SESSION_KEY = 'hanar_businessesFromBusinessSlug';

export function setBusinessesEnteredFromBusinessSlug() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* private mode / quota */
  }
}

export function peekBusinessesEnteredFromBusinessSlug(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearBusinessesBackToHomeFeedIntent() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Drop intent when user left the businesses directory (e.g. marketplace, home, another business). */
export function clearBusinessesBackToHomeFeedIfLeftDirectory(pathname: string) {
  if (typeof window === 'undefined') return;
  if (!pathname.startsWith('/businesses')) clearBusinessesBackToHomeFeedIntent();
}
