/** Lat/lng box for shading the selected search region on the map. */
export type MapAreaBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type MapAreaScopeLevel = 'city' | 'state' | 'country';

export function isValidMapAreaBounds(bounds: MapAreaBounds | null | undefined): bounds is MapAreaBounds {
  if (!bounds) return false;
  const { north, south, east, west } = bounds;
  return (
    Number.isFinite(north) &&
    Number.isFinite(south) &&
    Number.isFinite(east) &&
    Number.isFinite(west) &&
    north > south &&
    Math.abs(east - west) > 0.0001
  );
}

/** Fallback when geocoder returns a point but no viewport (degrees). */
export function approximateMapAreaBounds(
  center: { lat: number; lon: number },
  level: MapAreaScopeLevel
): MapAreaBounds {
  const latPad = level === 'country' ? 4.5 : level === 'state' ? 1.4 : 0.14;
  const lonPad =
    level === 'country'
      ? 6
      : level === 'state'
        ? 1.8
        : 0.18 / Math.max(0.35, Math.cos((center.lat * Math.PI) / 180));

  return {
    north: center.lat + latPad,
    south: center.lat - latPad,
    east: center.lon + lonPad,
    west: center.lon - lonPad,
  };
}

export function mapAreaBoundsFromGoogleViewport(viewport: {
  northeast: { lat: number; lng: number };
  southwest: { lat: number; lng: number };
}): MapAreaBounds {
  return {
    north: viewport.northeast.lat,
    south: viewport.southwest.lat,
    east: viewport.northeast.lng,
    west: viewport.southwest.lng,
  };
}

/** Nominatim boundingbox: [south, north, west, east] */
export function mapAreaBoundsFromOsmBbox(bbox: string[]): MapAreaBounds | null {
  if (!Array.isArray(bbox) || bbox.length < 4) return null;
  const south = parseFloat(bbox[0]);
  const north = parseFloat(bbox[1]);
  const west = parseFloat(bbox[2]);
  const east = parseFloat(bbox[3]);
  const bounds = { north, south, east, west };
  return isValidMapAreaBounds(bounds) ? bounds : null;
}
