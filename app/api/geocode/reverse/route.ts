import { NextResponse } from 'next/server';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

/** Server-side proxy for Nominatim reverse geocode. Use from browser to avoid CORS. */
export async function GET(req: Request) {
  try {
    const ip = getClientIp(req);
    if (await isRateLimited(`geocode-reverse:${ip}`)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    if (lat == null || lon == null) {
      return NextResponse.json({ error: 'Missing lat or lon' }, { status: 400 });
    }

    const upstreamUrl = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json`;
    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'hanar.net/1.0 (geocode proxy)',
        Accept: 'application/json',
      },
      next: { revalidate: 60 * 60 },
    });

    if (!upstreamRes.ok) {
      return NextResponse.json({ error: 'Reverse geocode failed' }, { status: upstreamRes.status });
    }

    const data = await upstreamRes.json();
    const res = NextResponse.json(data);
    res.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
