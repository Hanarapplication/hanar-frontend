import { isValidMapAreaBounds, type MapAreaBounds } from '@/lib/mapAreaBounds';

/** Exterior ring for a map polygon (lat/lng vertices). */
export type MapAreaRing = { lat: number; lng: number }[];

type LonLatPair = [number, number];

function ringFromLonLatPairs(coords: LonLatPair[]): MapAreaRing {
  return coords
    .map(([lon, lat]) => ({ lat, lng: lon }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

/** Parse Nominatim geojson (Polygon or MultiPolygon) into exterior rings. */
export function geoJsonToPolygonRings(geojson: { type?: string; coordinates?: unknown } | null | undefined): MapAreaRing[] {
  if (!geojson?.type || geojson.coordinates == null) return [];

  if (geojson.type === 'Polygon') {
    const rings = geojson.coordinates as LonLatPair[][];
    const outer = rings?.[0];
    if (!outer || outer.length < 3) return [];
    return [ringFromLonLatPairs(outer)];
  }

  if (geojson.type === 'MultiPolygon') {
    const polys = geojson.coordinates as LonLatPair[][][];
    return (polys ?? [])
      .map((poly) => {
        const outer = poly?.[0];
        return outer && outer.length >= 3 ? ringFromLonLatPairs(outer) : null;
      })
      .filter((ring): ring is MapAreaRing => Boolean(ring && ring.length >= 3));
  }

  return [];
}

export function boundsFromRings(rings: MapAreaRing[]): MapAreaBounds | null {
  if (rings.length === 0) return null;
  let north = -Infinity;
  let south = Infinity;
  let east = -Infinity;
  let west = Infinity;
  for (const ring of rings) {
    for (const p of ring) {
      north = Math.max(north, p.lat);
      south = Math.min(south, p.lat);
      east = Math.max(east, p.lng);
      west = Math.min(west, p.lng);
    }
  }
  const bounds = { north, south, east, west };
  return isValidMapAreaBounds(bounds) ? bounds : null;
}

export function hasValidAreaRings(rings: MapAreaRing[] | null | undefined): rings is MapAreaRing[] {
  return Array.isArray(rings) && rings.some((ring) => ring.length >= 3);
}
