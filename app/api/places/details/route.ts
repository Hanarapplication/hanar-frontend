import { NextResponse } from 'next/server';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

function parseAddressComponents(components: Array<{ long_name: string; short_name: string; types: string[] }>) {
  let streetNumber = '';
  let route = '';
  let locality = '';
  let state = '';
  let zip = '';
  let country = '';

  for (const c of components) {
    if (c.types.includes('street_number')) streetNumber = c.long_name;
    if (c.types.includes('route')) route = c.long_name;
    if (c.types.includes('locality')) locality = c.long_name;
    if (c.types.includes('administrative_area_level_1')) state = c.short_name || c.long_name;
    if (c.types.includes('postal_code')) zip = c.long_name;
    if (c.types.includes('country')) country = c.long_name;
  }

  const street = [streetNumber, route].filter(Boolean).join(' ').trim();
  return { street, city: locality, state, zip, country };
}

export async function GET(req: Request) {
  try {
    const ip = getClientIp(req);
    if (await isRateLimited(`places-details:${ip}`)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const placeId = searchParams.get('place_id')?.trim();

    if (!placeId) {
      return NextResponse.json({ error: 'Missing place_id' }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Places API not configured' }, { status: 503 });
    }

    const params = new URLSearchParams({
      place_id: placeId,
      fields: 'address_components,formatted_address,geometry',
      key: apiKey,
    });

    const url = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    const data = await res.json();

    if (data.status !== 'OK') {
      return NextResponse.json(
        { error: data.error_message || data.status || 'Place details failed' },
        { status: 400 }
      );
    }

    const result = data.result || {};
    const components = result.address_components || [];
    const parsed = parseAddressComponents(components);
    const formatted = result.formatted_address || '';
    const location = result.geometry?.location;
    const lat = location?.lat != null ? Number(location.lat) : undefined;
    const lng = location?.lng != null ? Number(location.lng) : undefined;

    return NextResponse.json({
      formatted_address: formatted,
      ...parsed,
      ...(lat != null && lng != null ? { lat, lng } : {}),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
