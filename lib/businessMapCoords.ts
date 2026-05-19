import { extractLatLonFromAddress, resolveLatLon } from '@/lib/geoDistance';

const GEOCODE_CACHE_KEY = 'hanar_business_geocode_cache';

export type GeocodeCache = Record<string, { lat: number; lon: number }>;

export type ParsedAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

/** Normalize Supabase address: jsonb object, JSON string, or plain text. */
export function normalizeAddressInput(address: unknown): unknown {
  if (address == null) return null;
  if (typeof address === 'string') {
    const trimmed = address.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed) as unknown;
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  return address;
}

export function parseAddressValue(address: unknown): ParsedAddress {
  const empty = { street: '', city: '', state: '', zip: '', country: '' };
  const normalized = normalizeAddressInput(address);
  if (normalized == null) return empty;
  if (typeof normalized === 'string') return { ...empty, street: normalized };
  if (typeof normalized === 'object' && !Array.isArray(normalized)) {
    const o = normalized as Record<string, unknown>;
    return {
      street:
        [o.street, o.line1, o.line_1, o.address_line1]
          .map((p) => (p == null ? '' : String(p).trim()))
          .find(Boolean) || '',
      city:
        [o.city, o.town, o.locality, o.village]
          .map((p) => (p == null ? '' : String(p).trim()))
          .find(Boolean) || '',
      state:
        [o.state, o.state_code, o.province, o.region]
          .map((p) => (p == null ? '' : String(p).trim()))
          .find(Boolean) || '',
      zip:
        [o.zip, o.postal_code, o.postcode]
          .map((p) => (p == null ? '' : String(p).trim()))
          .find(Boolean) || '',
      country: typeof o.country === 'string' ? o.country.trim() : '',
    };
  }
  return empty;
}

function isValidCoord(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  if (lat === 0 && lon === 0) return false;
  return true;
}

export function readGeocodeCache(): GeocodeCache {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(GEOCODE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as GeocodeCache;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeGeocodeCache(cache: GeocodeCache) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore quota */
  }
}

/** Build a geocodable string from common Supabase address shapes. */
export function formatAddressForGeocode(address: unknown): string | null {
  const normalized = normalizeAddressInput(address);
  if (normalized == null) return null;

  if (typeof normalized === 'string') {
    const trimmed = normalized.trim();
    return trimmed.length > 3 ? trimmed : null;
  }

  if (typeof normalized === 'object' && !Array.isArray(normalized)) {
    const a = normalized as Record<string, unknown>;
    const parts = [
      a.street,
      a.line1,
      a.line_1,
      a.address_line1,
      a.address,
      a.full_address,
      a.city ?? a.town ?? a.locality ?? a.village,
      a.state ?? a.state_code ?? a.province ?? a.region,
      a.zip ?? a.postal_code ?? a.postcode,
      a.country,
    ]
      .map((p) => (p == null ? '' : String(p).trim()))
      .filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
  }

  return null;
}

export function resolveBusinessCoords(
  row: { id: string; lat?: number | null; lon?: number | null; address?: unknown },
  cache: GeocodeCache
): { lat: number; lon: number } | null {
  const normalizedAddress = normalizeAddressInput(row.address);
  const direct = resolveLatLon({ lat: row.lat, lon: row.lon }, normalizedAddress ?? row.address);
  if (direct && isValidCoord(direct.lat, direct.lon)) return direct;
  const cached = cache[row.id];
  if (cached && isValidCoord(cached.lat, cached.lon)) return cached;
  return null;
}

/** Approximate Google Maps zoom for a search radius centered on the user. */
export function zoomForRadiusMiles(miles: number): number {
  if (miles <= 5) return 12;
  if (miles <= 10) return 11;
  if (miles <= 20) return 10;
  if (miles <= 40) return 9;
  if (miles <= 60) return 8;
  return 7;
}

export function milesToMeters(miles: number): number {
  return miles * 1609.344;
}

/** Continental US — default map when no location is chosen in the picker. */
export const USA_MAP_CENTER = { lat: 39.8283, lon: -98.5795 };
export const USA_MAP_ZOOM = 4;
export const USA_MAP_BOUNDS = {
  north: 49.5,
  south: 24.4,
  west: -124.8,
  east: -66.9,
};

export type GeocodeLocationHint = {
  city?: string;
  state?: string;
  country?: string;
};

/** Geocode string built only from the business `address` column (edit form / jsonb). */
export function addressGeocodeQueryFromTable(address: unknown): string | null {
  const formatted = formatAddressForGeocode(address);
  if (formatted && formatted.length > 6 && !formatted.startsWith('{')) return formatted;

  const parsed = parseAddressValue(address);
  const parts = [parsed.street, parsed.city, parsed.state, parsed.zip, parsed.country].filter(Boolean);
  if (parts.length >= 2) return parts.join(', ');
  if (parts.length === 1 && parts[0].length > 3) return parts[0];
  return null;
}

/** Legacy: map geocode with optional search-area hint when table address is incomplete. */
export function buildBusinessGeocodeQuery(
  address: unknown,
  locationHint?: GeocodeLocationHint | null,
  businessName?: string
): string | null {
  const fromTable = addressGeocodeQueryFromTable(address);
  if (fromTable) return fromTable;

  const parsed = parseAddressValue(address);
  const parts = [
    parsed.street,
    parsed.city || locationHint?.city,
    parsed.state || locationHint?.state,
    parsed.zip,
    parsed.country || locationHint?.country,
  ].filter(Boolean);
  if (parts.length >= 2) return parts.join(', ');

  const hintParts = [locationHint?.city, locationHint?.state, locationHint?.country].filter(Boolean);
  if (businessName?.trim() && hintParts.length > 0) {
    return `${businessName.trim()}, ${hintParts.join(', ')}`;
  }

  return null;
}

export type AddressWithCoords = Record<string, unknown> & {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  lat?: number;
  lng?: number;
};

/** Geocode a stored address and return DB-ready address + lat/lon columns. */
export async function geocodeStoredBusinessAddress(
  address: unknown
): Promise<{ lat: number; lon: number; address: AddressWithCoords } | null> {
  const query = addressGeocodeQueryFromTable(address);
  if (!query) return null;

  const coords = await geocodeAddressQuery(query);
  if (!coords || !isValidCoord(coords.lat, coords.lon)) return null;

  const normalized = normalizeAddressInput(address);
  const base: Record<string, unknown> =
    normalized && typeof normalized === 'object' && !Array.isArray(normalized)
      ? { ...(normalized as Record<string, unknown>) }
      : typeof normalized === 'string'
        ? { street: normalized }
        : {};

  const addressOut: AddressWithCoords = {
    ...base,
    lat: coords.lat,
    lng: coords.lon,
  };

  return { lat: coords.lat, lon: coords.lon, address: addressOut };
}

export async function geocodeAddressQuery(query: string): Promise<{ lat: number; lon: number } | null> {
  const q = query.trim();
  if (!q) return null;

  try {
    const googleRes = await fetch(`/api/geocode/forward?query=${encodeURIComponent(q)}`);
    if (googleRes.ok) {
      const google = (await googleRes.json()) as { lat?: number; lon?: number };
      if (google.lat != null && google.lon != null && Number.isFinite(google.lat) && Number.isFinite(google.lon)) {
        return { lat: google.lat, lon: google.lon };
      }
    }
  } catch {
    /* fall through to OSM */
  }

  try {
    const res = await fetch(
      `/api/geocode?query=${encodeURIComponent(q)}&limit=5&addressdetails=1`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      lat?: string;
      lon?: string;
      address?: { state?: string };
    }>;
    if (!Array.isArray(data) || data.length === 0) return null;

    const stateHint = q.toLowerCase().match(/,\s*([a-z]{2})\b/)?.[1];
    const picked =
      data.find((row) => {
        if (!stateHint) return true;
        const rowState = row.address?.state?.toLowerCase() ?? '';
        return rowState === stateHint || rowState.startsWith(stateHint);
      }) ?? data[0];

    const lat = parseFloat(String(picked.lat));
    const lon = parseFloat(String(picked.lon));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

/** Also try parsing coords embedded only in address JSON (no table columns). */
export function coordsFromAddressOnly(address: unknown): { lat: number; lon: number } | null {
  return extractLatLonFromAddress(address);
}
