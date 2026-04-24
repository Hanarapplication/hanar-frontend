import { NextResponse } from 'next/server';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

type GooglePrediction = { place_id: string; description: string };

async function fetchPredictions(
  input: string,
  apiKey: string,
  types: string
): Promise<GooglePrediction[]> {
  const params = new URLSearchParams({
    input,
    key: apiKey,
    ...(types ? { types } : {}),
  });

  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  const data = await res.json();
  if (data.status === 'ZERO_RESULTS') return [];
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || data.status || 'Autocomplete failed');
  }
  return (data.predictions || []).map((p: { place_id: string; description: string }) => ({
    place_id: p.place_id,
    description: p.description,
  }));
}

export async function GET(req: Request) {
  try {
    const ip = getClientIp(req);
    if (await isRateLimited(`places-autocomplete:${ip}`)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const input = searchParams.get('input')?.trim();
    const types = searchParams.get('types') || 'geocode'; // geocode = addresses + places; (cities) = cities only

    if (!input || input.length < 2) {
      return NextResponse.json({ predictions: [] }, { status: 200 });
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Places API not configured' }, { status: 503 });
    }

    let predictions: GooglePrediction[] = [];
    if (types === '(regions)') {
      // For location pickers, combine city + region results so inputs like
      // "frisco" suggest variants like "Frisco, TX" and "Frisco, CO".
      const [cities, regions] = await Promise.all([
        fetchPredictions(input, apiKey, '(cities)').catch(() => []),
        fetchPredictions(input, apiKey, '(regions)').catch(() => []),
      ]);
      const seen = new Set<string>();
      predictions = [...cities, ...regions].filter((p) => {
        if (!p.place_id || seen.has(p.place_id)) return false;
        seen.add(p.place_id);
        return true;
      });
      if (predictions.length === 0) {
        // Last-resort fallback: plain geocode query.
        predictions = await fetchPredictions(input, apiKey, 'geocode').catch(() => []);
      }
    } else {
      predictions = await fetchPredictions(input, apiKey, types);
    }

    return NextResponse.json({ predictions });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
