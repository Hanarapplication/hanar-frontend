export async function getLatLonFromAddress(
  address: string
): Promise<{ lat: number; lon: number; bounds?: { north: number; south: number; east: number; west: number } } | null> {
  try {
    const encodedAddress = encodeURIComponent(address);
    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    const res = await fetch(url);
    const json = await res.json();

    if (json.status === 'OK') {
      const result = json.results[0];
      const location = result.geometry.location;
      const viewport = result.geometry?.viewport ?? result.geometry?.bounds;
      let bounds: { north: number; south: number; east: number; west: number } | undefined;
      if (viewport?.northeast && viewport?.southwest) {
        bounds = {
          north: viewport.northeast.lat,
          south: viewport.southwest.lat,
          east: viewport.northeast.lng,
          west: viewport.southwest.lng,
        };
      }
      return {
        lat: location.lat,
        lon: location.lng,
        bounds,
      };
    }

    console.error('Geocoding failed:', json.status);
    return null;
  } catch (err) {
    console.error('Geocoding error:', err);
    return null;
  }
}
