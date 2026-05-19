import { NextResponse } from 'next/server';

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0]?.trim();
    if (ip) return ip;
  }
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return null;
}

function isPrivateOrLocalIp(ip: string): boolean {
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  return false;
}

/** Approximate lat/lon from the visitor's public IP (works on HTTP when GPS is blocked). */
export async function GET(req: Request) {
  const ip = clientIp(req);

  if (!ip || isPrivateOrLocalIp(ip)) {
    return NextResponse.json(
      {
        error: 'private_ip',
        message:
          'Cannot estimate location on a local network IP. Use http://localhost:3000, npm run dev:https, or deploy with HTTPS for GPS.',
      },
      { status: 503 }
    );
  }

  try {
    const upstream = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,lat,lon`,
      { cache: 'no-store' }
    );
    if (!upstream.ok) {
      return NextResponse.json({ error: 'upstream_failed' }, { status: 502 });
    }

    const data = (await upstream.json()) as {
      status?: string;
      message?: string;
      lat?: number;
      lon?: number;
    };

    if (data.status !== 'success' || data.lat == null || data.lon == null) {
      return NextResponse.json(
        { error: 'geocode_failed', message: data.message || 'No coordinates' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      lat: data.lat,
      lon: data.lon,
      approximate: true,
    });
  } catch {
    return NextResponse.json({ error: 'upstream_failed' }, { status: 502 });
  }
}
