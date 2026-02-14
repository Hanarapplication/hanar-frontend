import { NextResponse } from 'next/server';

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

/** GET ?q=... - Live city search (Open-Meteo). Returns { results: [{ label, lat, lng }] } */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const res = await fetch(
      `${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=15&language=en`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 0 } }
    );
    const data = await res.json().catch(() => ({}));
    const raw = (data.results || []) as Array<{ name?: string; admin1?: string; country_code?: string; latitude?: number; longitude?: number }>;

    const results = raw
      .filter((r) => r.latitude != null && r.longitude != null)
      .map((r) => {
        const parts = [r.name, r.admin1].filter(Boolean);
        const label = parts.length > 1 ? `${parts[0]}, ${parts[1]}` : (r.name || 'Unknown');
        return {
          label,
          lat: Number(r.latitude),
          lng: Number(r.longitude),
        };
      })
      .slice(0, 10);

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    return NextResponse.json({ error: message, results: [] }, { status: 500 });
  }
}
