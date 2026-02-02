import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { getLatLonFromAddress } from '@/lib/getLatLonFromAddress';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL');
if (!SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const buildAddressString = (address: any) => {
  if (!address) return '';
  if (typeof address === 'string') return address.trim();
  const parts = [
    address.street,
    address.city,
    address.state,
    address.zip,
    address.country,
  ]
    .map((part: any) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);
  return parts.join(', ');
};

type Payload = {
  businessId: string;
  title: string;
  body: string;
  url?: string | null;
  type?: 'business_update' | 'area_blast';
  radiusMiles?: number;
};

export async function POST(req: Request) {
  try {
    const supabaseServer = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
    let authedUser = user;

    if (!authedUser || authError) {
      const authHeader = req.headers.get('authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (token) {
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (error) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        authedUser = data.user || null;
      }
    }

    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = (await req.json()) as Payload;
    const businessId = (payload.businessId || '').trim();
    const title = (payload.title || '').trim();
    const body = (payload.body || '').trim();
    const url = (payload.url || '').trim() || null;
    const type = payload.type === 'area_blast' ? 'area_blast' : 'business_update';
    const radiusMiles = Number(payload.radiusMiles || 3);

    if (!businessId || !title || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (title.length > 140 || body.length > 1000) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 });
    }

    const { data: business, error: businessError } = await supabaseAdmin
      .from('businesses')
      .select('id, owner_id, plan, plan_selected_at, business_name, slug, lat, lon, address')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    if (business.owner_id !== authedUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!business.plan_selected_at) {
      return NextResponse.json({ error: 'Plan confirmation required' }, { status: 403 });
    }

    const { data: planSettings, error: planError } = await supabaseAdmin
      .from('business_plans')
      .select('follower_notifications_enabled, max_follower_notifications_per_week, max_follower_notifications_per_day, min_minutes_between_notifications, max_area_blasts_per_month, area_blast_requires_admin_approval, max_blast_radius_miles')
      .eq('plan', business.plan)
      .maybeSingle();

    if (planError || !planSettings) {
      return NextResponse.json({ error: 'Plan settings not found' }, { status: 404 });
    }
    if (type === 'business_update' && !planSettings.follower_notifications_enabled) {
      return NextResponse.json({ error: 'Follower notifications not enabled for your plan' }, { status: 403 });
    }

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    if (type === 'area_blast') {
      if (!planSettings.max_area_blasts_per_month || planSettings.max_area_blasts_per_month <= 0) {
        return NextResponse.json({ error: 'Area blasts not available for your plan' }, { status: 403 });
      }
      if (!business.lat || !business.lon) {
        const addressString = buildAddressString(business.address);
        if (!addressString) {
          return NextResponse.json({ error: 'Business location missing' }, { status: 400 });
        }
        const coords = await getLatLonFromAddress(addressString);
        if (!coords) {
          return NextResponse.json({ error: 'Unable to geocode business address' }, { status: 400 });
        }
        const { error: updateError } = await supabaseAdmin
          .from('businesses')
          .update({ lat: coords.lat, lon: coords.lon })
          .eq('id', business.id);
        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
        business.lat = coords.lat;
        business.lon = coords.lon;
      }
      if ((planSettings.max_blast_radius_miles || 0) < radiusMiles) {
        return NextResponse.json({ error: 'Radius exceeds plan limit' }, { status: 400 });
      }

      const { count: blastCount, error: blastCountError } = await supabaseAdmin
        .from('area_blast_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .in('status', ['pending', 'approved', 'sent'])
        .gte('created_at', monthAgo);
      if (blastCountError) {
        return NextResponse.json({ error: blastCountError.message }, { status: 500 });
      }
      if ((blastCount || 0) >= planSettings.max_area_blasts_per_month) {
        return NextResponse.json({ error: 'Monthly area blast limit reached' }, { status: 429 });
      }

      if (planSettings.area_blast_requires_admin_approval) {
        const { error: pendingError } = await supabaseAdmin.from('area_blast_outbox').insert({
          business_id: business.id,
          created_by: authedUser.id,
          title,
          body,
          url: url || (business.slug ? `/business/${business.slug}` : null),
          data: {
            business_name: business.business_name,
            radius_miles: radiusMiles,
          },
          radius_miles: radiusMiles,
          status: 'pending',
        });

        if (pendingError) {
          return NextResponse.json({ error: pendingError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, pending: true }, { status: 200 });
      }
    }

    if (type === 'business_update' && planSettings.max_follower_notifications_per_day > 0) {
      const { count, error: dayCountError } = await supabaseAdmin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'business_update')
        .contains('data', { business_id: business.id })
        .gte('created_at', dayAgo);
      if (dayCountError) {
        return NextResponse.json({ error: dayCountError.message }, { status: 500 });
      }
      if ((count || 0) >= planSettings.max_follower_notifications_per_day) {
        return NextResponse.json({ error: 'Daily notification limit reached' }, { status: 429 });
      }
    }

    if (type === 'business_update' && planSettings.max_follower_notifications_per_week > 0) {
      const { count, error: weekCountError } = await supabaseAdmin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'business_update')
        .contains('data', { business_id: business.id })
        .gte('created_at', weekAgo);
      if (weekCountError) {
        return NextResponse.json({ error: weekCountError.message }, { status: 500 });
      }
      if ((count || 0) >= planSettings.max_follower_notifications_per_week) {
        return NextResponse.json({ error: 'Weekly notification limit reached' }, { status: 429 });
      }
    }

    if (type === 'business_update' && planSettings.min_minutes_between_notifications > 0) {
      const { data: lastRows, error: lastError } = await supabaseAdmin
        .from('notifications')
        .select('created_at')
        .eq('type', 'business_update')
        .contains('data', { business_id: business.id })
        .order('created_at', { ascending: false })
        .limit(1);
      if (lastError) {
        return NextResponse.json({ error: lastError.message }, { status: 500 });
      }
      const lastCreated = lastRows?.[0]?.created_at;
      if (lastCreated) {
        const lastTime = new Date(lastCreated).getTime();
        const diffMinutes = Math.floor((now.getTime() - lastTime) / 60000);
        if (diffMinutes < planSettings.min_minutes_between_notifications) {
          return NextResponse.json(
            { error: 'Please wait before sending another notification' },
            { status: 429 }
          );
        }
      }
    }

    let uniqueUserIds: string[] = [];
    if (type === 'area_blast') {
      const milesPerDegreeLat = 69;
      const milesPerDegreeLon = 69 * Math.cos((Number(business.lat) * Math.PI) / 180);
      const deltaLat = radiusMiles / milesPerDegreeLat;
      const deltaLon = radiusMiles / Math.max(milesPerDegreeLon, 0.0001);

      const { data: locations, error: locationsError } = await supabaseAdmin
        .from('user_locations')
        .select('user_id, lat, lng, source')
        .gte('lat', Number(business.lat) - deltaLat)
        .lte('lat', Number(business.lat) + deltaLat)
        .gte('lng', Number(business.lon) - deltaLon)
        .lte('lng', Number(business.lon) + deltaLon)
        .in('source', ['gps', 'zip', 'city']);

      if (locationsError) {
        return NextResponse.json({ error: locationsError.message }, { status: 500 });
      }

      const toRad = (value: number) => (value * Math.PI) / 180;
      const distanceMiles = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 3959; // Earth radius in miles
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      uniqueUserIds = Array.from(new Set((locations || [])
        .filter((row: { user_id: string; lat: number; lng: number }) => {
          const distance = distanceMiles(
            Number(business.lat),
            Number(business.lon),
            Number(row.lat),
            Number(row.lng)
          );
          return distance <= radiusMiles;
        })
        .map((row: { user_id: string }) => row.user_id)))
        .filter((id) => id && id !== business.owner_id);
    } else {
      const { data: followers, error: followersError } = await supabaseAdmin
        .from('business_favorites')
        .select('user_id')
        .eq('business_id', businessId);

      if (followersError) {
        return NextResponse.json({ error: followersError.message }, { status: 500 });
      }

      uniqueUserIds = Array.from(new Set((followers || []).map((row: { user_id: string }) => row.user_id)))
        .filter((id) => id && id !== business.owner_id);
    }
    const defaultUrl = business.slug ? `/business/${business.slug}` : null;
    const rows = uniqueUserIds.map((userId) => ({
      user_id: userId,
      type,
      title,
      body,
      url: url || defaultUrl,
      data: {
        business_id: business.id,
        business_name: business.business_name,
        radius_miles: type === 'area_blast' ? radiusMiles : undefined,
      },
    }));

    if (rows.length > 0) {
      const { error: insertError } = await supabaseAdmin.from('notifications').insert(rows);
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    if (type === 'area_blast') {
      const { error: outboxError } = await supabaseAdmin.from('area_blast_outbox').insert({
        business_id: business.id,
        created_by: authedUser.id,
        title,
        body,
        url: url || defaultUrl,
        data: {
          business_name: business.business_name,
          radius_miles: radiusMiles,
          sent_count: rows.length,
        },
        radius_miles: radiusMiles,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      if (outboxError) {
        return NextResponse.json({ error: outboxError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, sent: rows.length }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}
