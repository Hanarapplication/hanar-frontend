import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getLatLonFromAddress } from '@/lib/getLatLonFromAddress';
import { sendApprovalNotification } from '@/lib/sendApprovalNotification';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL');
if (!SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const allowedRoles = ['owner', 'ceo', 'topmanager', 'manager', 'reviewer', 'business'];

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

const distanceMiles = (lat1: number, lon1: number, lat2: number, lon2: number) => {
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
};

export async function GET() {
  try {
    const cookieStore = await cookies();
    const role = cookieStore.get('adminRole')?.value;
    if (!role || !allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('area_blast_outbox')
      .select('id, business_id, title, body, created_at, data, radius_miles, status')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ requests: data || [] }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const role = cookieStore.get('adminRole')?.value;
    if (!role || !allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const id = String(body.id || '');
    const action = String(body.action || '');
    if (!id || !['approve', 'reject', 'delete', 'update'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    let pending: any = null;
    if (action !== 'delete') {
      const { data, error } = await supabaseAdmin
        .from('area_blast_outbox')
        .select('id, business_id, title, body, url, created_at, data, radius_miles, status, created_by')
        .eq('id', id)
        .maybeSingle();
      if (error || !data) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }
      pending = data;
    }

    if (action === 'reject') {
      const { error } = await supabaseAdmin
        .from('area_blast_outbox')
        .update({ status: 'rejected', approved_at: new Date().toISOString(), approved_by: null })
        .eq('id', id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (action === 'delete') {
      const { error } = await supabaseAdmin
        .from('area_blast_outbox')
        .delete()
        .eq('id', id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (action === 'update') {
      const nextTitle = String(body.title || '').trim();
      const nextBody = String(body.body || '').trim();
      const nextRadius = Number(body.radiusMiles || pending?.radius_miles || 3);
      if (!nextTitle || !nextBody) {
        return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
      }
      const { error } = await supabaseAdmin
        .from('area_blast_outbox')
        .update({
          title: nextTitle,
          body: nextBody,
          radius_miles: nextRadius,
          data: {
            ...(pending?.data || {}),
            radius_miles: nextRadius,
          },
        })
        .eq('id', id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const businessId = pending.business_id;
    const radiusMiles = Number(pending.radius_miles || pending.data?.radius_miles || 3);
    if (!businessId) {
      return NextResponse.json({ error: 'Missing business id' }, { status: 400 });
    }

    const { data: business, error: businessError } = await supabaseAdmin
      .from('businesses')
      .select('id, slug, lat, lon, business_name, owner_id, address')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
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

    const locationsList = locations || [];
    const matching = locationsList.filter((row: { user_id: string; lat: number; lng: number }) => {
      const distance = distanceMiles(
        Number(business.lat),
        Number(business.lon),
        Number(row.lat),
        Number(row.lng)
      );
      return distance <= radiusMiles;
    });
    const uniqueMatchedIds = Array.from(new Set(matching.map((row: { user_id: string }) => row.user_id))).filter(
      (id) => Boolean(id)
    );
    const recipients = uniqueMatchedIds.filter((userId) => userId !== business.owner_id);
    const excludedOwner = uniqueMatchedIds.length - recipients.length;

    const defaultUrl = business.slug ? `/business/${business.slug}` : null;
    const rows = recipients.map((userId) => ({
      user_id: userId,
      type: 'area_blast',
      title: pending.title,
      body: pending.body,
      url: pending.url || defaultUrl,
      data: {
        business_id: business.id,
        business_name: business.business_name,
        radius_miles: radiusMiles,
      },
    }));

    if (rows.length > 0) {
      const { error: insertError } = await supabaseAdmin.from('notifications').insert(rows);
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('area_blast_outbox')
      .update({
        status: 'sent',
        approved_at: new Date().toISOString(),
        approved_by: null,
        sent_at: new Date().toISOString(),
        data: {
          ...(pending.data || {}),
          sent_count: rows.length,
          radius_miles: radiusMiles,
        },
      })
      .eq('id', id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await sendApprovalNotification('area_blast', id, { sentCount: rows.length });

    return NextResponse.json(
      {
        success: true,
        sent: rows.length,
        locationCandidates: locationsList.length,
        matched: uniqueMatchedIds.length,
        excludedOwner,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}
