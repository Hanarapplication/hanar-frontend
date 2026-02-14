import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getLatLonFromAddress } from '@/lib/getLatLonFromAddress';
import { isPushConfigured, sendPushToTokens } from '@/lib/firebaseAdmin';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const allowedRoles = ['owner', 'ceo', 'topmanager', 'manager', 'reviewer', 'business'];

function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 3959;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const role = cookieStore.get('adminRole')?.value;
  return !!role && allowedRoles.includes(role);
}

export async function GET(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');
    const blast = mode === 'blast';
    const { data: rows, error } = await supabaseAdmin
      .from('notifications')
      .select('id, title, body, created_at, data')
      .eq('type', 'admin_broadcast')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const byCampaign = new Map<string, { campaignId: string; title: string; body: string; createdAt: string; count: number }>();
    for (const row of rows || []) {
      const d = (row.data as Record<string, unknown>) || {};
      const isBlast = Boolean(d.blast);
      if (isBlast !== blast) continue;
      const cid = String(d.admin_sent_id || '');
      if (!cid) continue;
      const existing = byCampaign.get(cid);
      if (existing) {
        existing.count += 1;
      } else {
        byCampaign.set(cid, {
          campaignId: cid,
          title: row.title || '',
          body: row.body || '',
          createdAt: row.created_at || '',
          count: 1,
        });
      }
    }
    const history = Array.from(byCampaign.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return NextResponse.json({ history });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId');
    if (!campaignId || !campaignId.trim()) {
      return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('type', 'admin_broadcast')
      .filter('data->>admin_sent_id', 'eq', campaignId.trim());
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type Payload = {
  targets?: { organizations?: boolean; businesses?: boolean; individuals?: boolean };
  receiver_ids?: string[];
  title?: string;
  body?: string;
  url?: string | null;
  mode?: 'direct' | 'blast';
  blastDelivery?: 'in_app' | 'push' | 'both';
  radiusMiles?: number | null;
  unlimitedRadius?: boolean;
  lat?: number | null;
  lon?: number | null;
  address?: string | null;
};

export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as Payload | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

    const title = String(body.title ?? '').trim();
    const bodyText = String(body.body ?? '').trim();
    const url = body.url ? String(body.url).trim() || null : null;

    if (!title || !bodyText) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }
    if (title.length > 140 || bodyText.length > 1000) {
      return NextResponse.json({ error: 'Title max 140 chars, body max 1000 chars' }, { status: 400 });
    }

    const receiverIdsRaw = Array.isArray(body.receiver_ids) ? body.receiver_ids : [];
    const receiverIds = receiverIdsRaw.filter((id) => typeof id === 'string' && id.trim().length > 0);
    const useTargeted = receiverIds.length > 0;

    const targets = body.targets ?? {};
    const organizations = Boolean(targets.organizations);
    const businesses = Boolean(targets.businesses);
    const individuals = Boolean(targets.individuals);

    if (!useTargeted && !organizations && !businesses && !individuals) {
      return NextResponse.json(
        { error: 'Select at least one target or add specific receivers' },
        { status: 400 }
      );
    }

    const mode = body.mode === 'blast' ? 'blast' : 'direct';
    const blastDelivery = body.blastDelivery === 'push' ? 'push' : body.blastDelivery === 'both' ? 'both' : 'in_app';
    const unlimitedRadius = Boolean(body.unlimitedRadius);
    const radiusMiles = body.radiusMiles != null ? Number(body.radiusMiles) : null;
    let lat = body.lat != null ? Number(body.lat) : null;
    let lon = body.lon != null ? Number(body.lon) : null;
    const address = body.address ? String(body.address).trim() || null : null;

    if (!useTargeted && mode === 'blast' && !unlimitedRadius && (radiusMiles == null || radiusMiles <= 0)) {
      return NextResponse.json(
        { error: 'Blast requires either unlimited radius or a positive radius in miles' },
        { status: 400 }
      );
    }

    if (!useTargeted && mode === 'blast' && !unlimitedRadius) {
      if (address) {
        const coords = await getLatLonFromAddress(address);
        if (!coords) return NextResponse.json({ error: 'Could not geocode address' }, { status: 400 });
        lat = coords.lat;
        lon = coords.lon;
      }
      if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
        return NextResponse.json(
          { error: 'Blast with radius requires center: set address or lat/lon' },
          { status: 400 }
        );
      }
    }

    let recipientIds: string[];

    if (useTargeted) {
      recipientIds = [...new Set(receiverIds)];
    } else {
      const targetUserIds = new Set<string>();

      if (organizations) {
        const { data: orgs } = await supabaseAdmin
          .from('organizations')
          .select('user_id')
          .not('user_id', 'is', null);
        for (const o of orgs || []) {
          if (o.user_id) targetUserIds.add(o.user_id);
        }
      }

      if (businesses) {
        const { data: bizList } = await supabaseAdmin
          .from('businesses')
          .select('owner_id')
          .not('owner_id', 'is', null);
        for (const b of bizList || []) {
          if (b.owner_id) targetUserIds.add(b.owner_id);
        }
      }

      if (individuals) {
        const { data: ra } = await supabaseAdmin
          .from('registeredaccounts')
          .select('user_id')
          .eq('business', false)
          .eq('organization', false)
          .not('user_id', 'is', null);
        for (const r of ra || []) {
          if (r.user_id) targetUserIds.add(r.user_id);
        }
      }

      recipientIds = Array.from(targetUserIds);
    }

    if (!useTargeted && mode === 'blast' && !unlimitedRadius && lat != null && lon != null && radiusMiles != null && radiusMiles > 0) {
      const milesPerDegreeLat = 69;
      const milesPerDegreeLon = 69 * Math.cos((lat * Math.PI) / 180);
      const deltaLat = radiusMiles / milesPerDegreeLat;
      const deltaLon = radiusMiles / Math.max(milesPerDegreeLon, 0.0001);

      const { data: locations, error: locErr } = await supabaseAdmin
        .from('user_locations')
        .select('user_id, lat, lng')
        .gte('lat', lat - deltaLat)
        .lte('lat', lat + deltaLat)
        .gte('lng', lon - deltaLon)
        .lte('lng', lon + deltaLon)
        .in('source', ['gps', 'zip', 'city']);

      if (locErr) {
        return NextResponse.json({ error: locErr.message }, { status: 500 });
      }

      const targetSet = new Set(recipientIds);
      const inRadius = new Set<string>();
      for (const row of locations || []) {
        const dist = distanceMiles(lat, lon, Number(row.lat), Number(row.lng));
        if (dist <= radiusMiles && row.user_id && targetSet.has(row.user_id)) {
          inRadius.add(row.user_id);
        }
      }
      recipientIds = Array.from(inRadius);
    }

    const campaignId = crypto.randomUUID();
    let inAppSent = 0;
    const doInApp = mode !== 'blast' || blastDelivery === 'in_app' || blastDelivery === 'both';
    const rows = recipientIds.map((user_id) => ({
      user_id,
      type: 'admin_broadcast',
      title,
      body: bodyText,
      url,
      data: {
        admin_broadcast: true,
        admin_sent_id: campaignId,
        targets: useTargeted ? undefined : { organizations, businesses, individuals },
        targeted_user_ids: useTargeted ? recipientIds : undefined,
        blast: mode === 'blast',
        radius_miles: mode === 'blast' && !unlimitedRadius ? radiusMiles : undefined,
        unlimited_radius: mode === 'blast' && unlimitedRadius,
      },
    }));

    if (rows.length > 0 && doInApp) {
      const { error: insertError } = await supabaseAdmin.from('notifications').insert(rows);
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      inAppSent = rows.length;
    }

    let pushSent = 0;
    const doPush = mode === 'blast' && (blastDelivery === 'push' || blastDelivery === 'both');
    if (doPush && recipientIds.length > 0) {
      if (!isPushConfigured()) {
        return NextResponse.json(
          { error: 'Push notifications are not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON.' },
          { status: 503 }
        );
      }
      const [appTokensRes, webTokensRes] = await Promise.all([
        supabaseAdmin.from('user_push_tokens').select('token').in('user_id', recipientIds),
        supabaseAdmin.from('push_tokens').select('token').in('user_id', recipientIds),
      ]);
      const appTokens = (appTokensRes.data || []).map((r: { token: string }) => r.token).filter(Boolean);
      const webTokens = webTokensRes.error ? [] : (webTokensRes.data || []).map((r: { token: string }) => r.token).filter(Boolean);
      const tokens = Array.from(new Set([...appTokens, ...webTokens]));
      if (tokens.length > 0) {
        const { successCount } = await sendPushToTokens(title, bodyText, url, tokens);
        pushSent = successCount;
      }
    }

    return NextResponse.json({
      success: true,
      sent: doInApp ? inAppSent : pushSent,
      inAppSent: doInApp ? inAppSent : 0,
      pushSent,
      campaignId,
      mode,
      blastDelivery: mode === 'blast' ? blastDelivery : undefined,
      targets: { organizations, businesses, individuals },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
