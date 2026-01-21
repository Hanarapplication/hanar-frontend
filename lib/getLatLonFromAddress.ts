export async function getLatLonFromAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const encodedAddress = encodeURIComponent(address);
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    const res = await fetch(url);
    const json = await res.json();

    if (json.status === 'OK') {
      const location = json.results[0].geometry.location;
      return {
        lat: location.lat,
        lon: location.lng,
      };
    }

    console.error('Geocoding failed:', json.status);
    return null;
  } catch (err) {
    console.error('Geocoding error:', err);
    return null;
  }
}
