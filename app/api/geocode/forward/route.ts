import { NextResponse } from 'next/server';
import { getLatLonFromAddress } from '@/lib/getLatLonFromAddress';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

export async function GET(req: Request) {
  try {
    const ip = getClientIp(req);
    if (await isRateLimited(`geocode-forward:${ip}`)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const query = new URL(req.url).searchParams.get('query')?.trim();
    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    const coords = await getLatLonFromAddress(query);
    if (!coords) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const res = NextResponse.json(coords);
    res.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
