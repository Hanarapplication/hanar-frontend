import type { MarketplaceLocationScope } from '@/lib/marketplaceLocationFilter';
import type { MapAreaBounds } from '@/lib/mapAreaBounds';
import { isValidMapAreaBounds } from '@/lib/mapAreaBounds';
import type { MapAreaRing } from '@/lib/mapAreaPolygon';
import { hasValidAreaRings } from '@/lib/mapAreaPolygon';
import { USA_MAP_CENTER } from '@/lib/businessMapCoords';

/** Last businesses-map area + search box — survives revisits until the user picks a new location. */
export const BUSINESSES_MAP_LOCATION_KEY = 'hanar_businesses_map_location_v1';

const LEGACY_SCOPE_KEY = 'userLocationScope';
const LEGACY_LABEL_KEY = 'userLocationLabel';
const LEGACY_COORDS_KEY = 'userCoords';
const LEGACY_CENTER_KEY = 'hanar_map_view_center';
const LEGACY_BOUNDS_KEY = 'hanar_map_area_bounds_v2';

export type BusinessesMapLocationSnapshot = {
  version: 1;
  /** Text shown in the map location search box */
  searchText: string;
  label: string | null;
  scope: MarketplaceLocationScope;
  center: { lat: number; lon: number } | null;
  bounds: MapAreaBounds | null;
  rings: MapAreaRing[] | null;
  userCoords: { lat: number; lon: number } | null;
  radiusMiles: number;
  updatedAt: number;
};

function isScope(value: unknown): value is MarketplaceLocationScope {
  if (!value || typeof value !== 'object') return false;
  const mode = (value as { mode?: string }).mode;
  return mode === 'none' || mode === 'country' || mode === 'state' || mode === 'city_radius';
}

function readCoords(raw: unknown): { lat: number; lon: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const lat = (raw as { lat?: number }).lat;
  const lon = (raw as { lon?: number; lng?: number }).lon ?? (raw as { lng?: number }).lng;
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function readLegacySnapshot(radiusMiles: number): BusinessesMapLocationSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    let scope: MarketplaceLocationScope = { mode: 'none' };
    const rawScope = localStorage.getItem(LEGACY_SCOPE_KEY);
    if (rawScope) {
      const parsed = JSON.parse(rawScope);
      if (isScope(parsed)) scope = parsed;
    } else if (localStorage.getItem(LEGACY_COORDS_KEY)) {
      scope = { mode: 'city_radius', country: '', state: '', city: '' };
    }

    const label = localStorage.getItem(LEGACY_LABEL_KEY);
    const userCoords = readCoords(
      localStorage.getItem(LEGACY_COORDS_KEY)
        ? JSON.parse(localStorage.getItem(LEGACY_COORDS_KEY) as string)
        : null
    );
    const center = readCoords(
      localStorage.getItem(LEGACY_CENTER_KEY)
        ? JSON.parse(localStorage.getItem(LEGACY_CENTER_KEY) as string)
        : null
    );

    let bounds: MapAreaBounds | null = null;
    let rings: MapAreaRing[] | null = null;
    let boundsCenter: { lat: number; lon: number } | null = null;
    const rawBounds = localStorage.getItem(LEGACY_BOUNDS_KEY);
    if (rawBounds) {
      const cached = JSON.parse(rawBounds) as {
        bounds?: MapAreaBounds;
        rings?: MapAreaRing[];
        lat?: number;
        lon?: number;
      };
      if (isValidMapAreaBounds(cached.bounds)) bounds = cached.bounds!;
      if (hasValidAreaRings(cached.rings)) rings = cached.rings!;
      if (cached.lat != null && cached.lon != null) {
        boundsCenter = { lat: cached.lat, lon: cached.lon };
      }
    }

    const searchText =
      (label || '').trim() ||
      (scope.mode === 'country' && scope.country.trim()) ||
      (scope.mode === 'state' && [scope.state, scope.country].filter(Boolean).join(', ')) ||
      (scope.mode === 'city_radius' && scope.city.trim()
        ? [scope.city, scope.state, scope.country].filter(Boolean).join(', ')
        : '') ||
      '';

    const hasAnything =
      Boolean(searchText) ||
      scope.mode !== 'none' ||
      Boolean(userCoords) ||
      Boolean(center) ||
      Boolean(bounds);

    if (!hasAnything) return null;

    return {
      version: 1,
      searchText,
      label: label || (searchText ? searchText : null),
      scope,
      center: center ?? boundsCenter ?? userCoords,
      bounds,
      rings,
      userCoords,
      radiusMiles,
      updatedAt: 0,
    };
  } catch {
    return null;
  }
}

export function readBusinessesMapLocation(
  fallbackRadiusMiles = 40
): BusinessesMapLocationSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BUSINESSES_MAP_LOCATION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BusinessesMapLocationSnapshot;
      if (parsed?.version === 1 && isScope(parsed.scope)) {
        return {
          version: 1,
          searchText: typeof parsed.searchText === 'string' ? parsed.searchText : '',
          label: typeof parsed.label === 'string' ? parsed.label : parsed.label ?? null,
          scope: parsed.scope,
          center: readCoords(parsed.center),
          bounds: isValidMapAreaBounds(parsed.bounds) ? parsed.bounds : null,
          rings: hasValidAreaRings(parsed.rings) ? parsed.rings : null,
          userCoords: readCoords(parsed.userCoords),
          radiusMiles:
            typeof parsed.radiusMiles === 'number' && Number.isFinite(parsed.radiusMiles)
              ? parsed.radiusMiles
              : fallbackRadiusMiles,
          updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
        };
      }
    }
  } catch {
    /* fall through to legacy */
  }
  return readLegacySnapshot(fallbackRadiusMiles);
}

export function writeBusinessesMapLocation(
  snapshot: Omit<BusinessesMapLocationSnapshot, 'version' | 'updatedAt'> & {
    updatedAt?: number;
  }
): void {
  if (typeof window === 'undefined') return;
  const next: BusinessesMapLocationSnapshot = {
    version: 1,
    searchText: snapshot.searchText.trim(),
    label: snapshot.label,
    scope: snapshot.scope,
    center: snapshot.center,
    bounds: isValidMapAreaBounds(snapshot.bounds) ? snapshot.bounds : null,
    rings: hasValidAreaRings(snapshot.rings) ? snapshot.rings : null,
    userCoords: snapshot.userCoords,
    radiusMiles: snapshot.radiusMiles,
    updatedAt: snapshot.updatedAt ?? Date.now(),
  };

  try {
    localStorage.setItem(BUSINESSES_MAP_LOCATION_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota */
  }

  // Keep shared location keys in sync for other surfaces (marketplace, etc.).
  try {
    localStorage.setItem(LEGACY_SCOPE_KEY, JSON.stringify(next.scope));
    if (next.label) localStorage.setItem(LEGACY_LABEL_KEY, next.label);
    else if (next.searchText) localStorage.setItem(LEGACY_LABEL_KEY, next.searchText);
    if (next.userCoords) {
      localStorage.setItem(LEGACY_COORDS_KEY, JSON.stringify(next.userCoords));
    }
    if (next.center) {
      localStorage.setItem(LEGACY_CENTER_KEY, JSON.stringify(next.center));
    }
    if (next.center && next.bounds) {
      localStorage.setItem(
        LEGACY_BOUNDS_KEY,
        JSON.stringify({
          query: next.searchText || next.label || '',
          lat: next.center.lat,
          lon: next.center.lon,
          bounds: next.bounds,
          rings: next.rings,
        })
      );
    }
  } catch {
    /* ignore */
  }
}

export function defaultMapCenterFromSnapshot(
  snapshot: BusinessesMapLocationSnapshot | null
): { lat: number; lon: number } {
  return snapshot?.center ?? snapshot?.userCoords ?? USA_MAP_CENTER;
}

export function hasSavedBusinessesMapLocation(
  snapshot: BusinessesMapLocationSnapshot | null
): boolean {
  if (!snapshot) return false;
  if (snapshot.searchText.trim()) return true;
  if (snapshot.label?.trim()) return true;
  if (snapshot.scope.mode !== 'none') return true;
  if (snapshot.userCoords) return true;
  if (snapshot.center) return true;
  return false;
}
