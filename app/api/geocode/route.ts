import { NextResponse } from 'next/server';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

export async function GET(req: Request) {
  try {
    const ip = getClientIp(req);
    if (await isRateLimited(`geocode:${ip}`)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query') || searchParams.get('q');
    const addressDetails = searchParams.get('addressdetails');
    const limit = searchParams.get('limit');

    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    const params = new URLSearchParams({
      format: 'json',
      q: query,
    });
    if (addressDetails) params.set('addressdetails', addressDetails);
    if (limit) params.set('limit', limit);

    const upstreamUrl = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'hanar.net/1.0 (geocode proxy)',
        Accept: 'application/json',
      },
      next: { revalidate: 60 * 60 },
    });

    if (!upstreamRes.ok) {
      return NextResponse.json({ error: 'Geocode failed' }, { status: upstreamRes.status });
    }

    const data = await upstreamRes.json();
    const res = NextResponse.json(data);
    res.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}
