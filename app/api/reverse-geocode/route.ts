import { NextResponse } from 'next/server';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

export async function GET(req: Request) {
  try {
    const ip = getClientIp(req);
    if (await isRateLimited(`reverse-geocode:${ip}`)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get('lat'));
    const lon = Number(searchParams.get('lon'));

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    const upstreamUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
      String(lat)
    )}&lon=${encodeURIComponent(String(lon))}`;

    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'hanar.net/1.0 (reverse-geocode proxy)',
        Accept: 'application/json',
      },
      next: { revalidate: 60 * 60 },
    });

    if (!upstreamRes.ok) {
      return NextResponse.json({ error: 'Reverse geocode failed' }, { status: upstreamRes.status });
    }

    const data = await upstreamRes.json();
    const res = NextResponse.json(data);
    res.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}
