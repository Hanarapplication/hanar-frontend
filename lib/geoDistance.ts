/** Earth radius in miles (WGS84 mean) */
const R_MI = 3958.7613;

/**
 * Haversine distance in miles between two WGS84 points.
 */
export function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_MI * c;
}

/**
 * Read lat/lng from a JSON address object or JSON string (common Supabase shapes).
 */
export function extractLatLonFromAddress(value: unknown): { lat: number; lon: number } | null {
  if (value == null) return null;
  let obj: Record<string, unknown> | null = null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    obj = value as Record<string, unknown>;
  } else if (typeof value === 'string') {
    const s = value.trim();
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) obj = parsed as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }
  if (!obj) return null;
  const latRaw = obj.lat ?? obj.latitude;
  const lonRaw = obj.lng ?? obj.lon ?? obj.longitude;
  if (latRaw == null || lonRaw == null) return null;
  const lat = typeof latRaw === 'number' ? latRaw : parseFloat(String(latRaw));
  const lon = typeof lonRaw === 'number' ? lonRaw : parseFloat(String(lonRaw));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/**
 * Prefer table columns; fall back to coordinates embedded in `address`.
 */
export function resolveLatLon(
  row: { lat?: number | string | null; lon?: number | string | null },
  address?: unknown
): { lat: number; lon: number } | null {
  if (row.lat != null && row.lon != null) {
    const lat = typeof row.lat === 'number' ? row.lat : parseFloat(String(row.lat));
    const lon = typeof row.lon === 'number' ? row.lon : parseFloat(String(row.lon));
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  return extractLatLonFromAddress(address);
}

export const SEARCH_RADIUS_MILES_STORAGE_KEY = 'hanar_search_radius_miles';

export function readSavedSearchRadiusMiles(defaultMiles = 40, min = 10, max = 100): number {
  if (typeof window === 'undefined') return defaultMiles;
  try {
    const r = localStorage.getItem(SEARCH_RADIUS_MILES_STORAGE_KEY);
    if (r == null) return defaultMiles;
    const n = Number(r);
    if (!Number.isFinite(n)) return defaultMiles;
    return Math.min(max, Math.max(min, Math.round(n)));
  } catch {
    return defaultMiles;
  }
}

export function writeSavedSearchRadiusMiles(miles: number, min = 10, max = 100): void {
  if (typeof window === 'undefined') return;
  try {
    const n = Math.min(max, Math.max(min, Math.round(Number(miles))));
    localStorage.setItem(SEARCH_RADIUS_MILES_STORAGE_KEY, String(n));
  } catch {
    /* ignore */
  }
}
