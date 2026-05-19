export type BrowserLocationErrorCode =
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unsupported'
  | 'insecure';

export type BrowserLocationResult =
  | { ok: true; lat: number; lon: number; approximate?: boolean }
  | { ok: false; code: BrowserLocationErrorCode };

function geolocationErrorCode(error: GeolocationPositionError | null): BrowserLocationErrorCode {
  if (!error) return 'unavailable';
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'denied';
    case error.TIMEOUT:
      return 'timeout';
    default:
      return 'unavailable';
  }
}

const LOCATION_ATTEMPTS: PositionOptions[] = [
  { enableHighAccuracy: false, timeout: 25_000, maximumAge: 300_000 },
  { enableHighAccuracy: true, timeout: 30_000, maximumAge: 60_000 },
];

function canUseGps(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'geolocation' in navigator &&
    Boolean(navigator.geolocation)
  );
}

/**
 * Request GPS in the same turn as a user click (do not await before calling).
 */
export function requestBrowserLocation(): Promise<BrowserLocationResult> {
  if (!canUseGps()) {
    return Promise.resolve({
      ok: false,
      code: typeof window !== 'undefined' && !window.isSecureContext ? 'insecure' : 'unsupported',
    });
  }

  return new Promise((resolve) => {
    let lastError: GeolocationPositionError | null = null;
    let attemptIndex = 0;

    const tryNext = () => {
      if (attemptIndex >= LOCATION_ATTEMPTS.length) {
        resolve({ ok: false, code: geolocationErrorCode(lastError) });
        return;
      }

      const options = LOCATION_ATTEMPTS[attemptIndex++];
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            tryNext();
            return;
          }
          resolve({ ok: true, lat, lon });
        },
        (err) => {
          lastError = err;
          if (err.code === err.PERMISSION_DENIED) {
            resolve({ ok: false, code: 'denied' });
            return;
          }
          tryNext();
        },
        options
      );
    };

    tryNext();
  });
}

/** Server-side IP geolocation fallback (HTTP / non-GPS). */
export async function fetchApproximateIpLocation(): Promise<BrowserLocationResult> {
  try {
    const res = await fetch('/api/geocode/ip', { cache: 'no-store' });
    const data = (await res.json().catch(() => ({}))) as {
      lat?: number;
      lon?: number;
      error?: string;
    };
    if (res.ok && data.lat != null && data.lon != null) {
      return { ok: true, lat: data.lat, lon: data.lon, approximate: true };
    }
  } catch {
    /* ignore */
  }
  return { ok: false, code: 'unavailable' };
}

/**
 * GPS when HTTPS/localhost; otherwise approximate IP location.
 * Call directly from a click handler (starts GPS synchronously when available).
 */
export function requestLocationWithFallback(): Promise<BrowserLocationResult> {
  if (canUseGps()) {
    return requestBrowserLocation().then(async (gps) => {
      if (gps.ok) return gps;
      const approx = await fetchApproximateIpLocation();
      if (approx.ok) return approx;
      return gps;
    });
  }

  return fetchApproximateIpLocation().then((approx) => {
    if (approx.ok) return approx;
    return {
      ok: false,
      code:
        typeof window !== 'undefined' && !window.isSecureContext ? 'insecure' : 'unavailable',
    };
  });
}

export function readStoredCoords(keys: string[]): { lat: number; lon: number } | null {
  if (typeof window === 'undefined') return null;
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { lat?: number; lon?: number; lng?: number };
      const lat = parsed.lat;
      const lon = parsed.lon ?? parsed.lng;
      if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
        return { lat, lon };
      }
    } catch {
      /* try next key */
    }
  }
  return null;
}
