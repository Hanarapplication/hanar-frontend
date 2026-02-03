import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

type Payload = {
  lat: number;
  lon?: number;
  lng?: number;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  source?: string | null;
};

export async function POST(req: Request) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL');
    if (!SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    let authedUser: { id: string } | null = null;
    let usedServiceRole = false;
    let supabaseServer: ReturnType<typeof createRouteHandlerClient> | null = null;

    if (token) {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      authedUser = data.user;
      usedServiceRole = true;
    } else {
      supabaseServer = createRouteHandlerClient({ cookies });
      const { data: { user }, error } = await supabaseServer.auth.getUser();
      if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      authedUser = user;
    }

    const payload = (await req.json()) as Payload;
    const lat = Number(payload.lat);
    const lng = Number(payload.lng ?? payload.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    const city = payload.city ? String(payload.city).trim() : null;
    const state = payload.state ? String(payload.state).trim() : null;
    const zip = payload.zip ? String(payload.zip).trim() : null;
    const source = payload.source ? String(payload.source).trim() : null;

    const writeClient = usedServiceRole ? supabaseAdmin : supabaseServer!;
    const { error } = await writeClient
      .from('user_locations')
      .upsert(
        {
          user_id: authedUser.id,
          lat,
          lng,
          ...(city !== null ? { city } : {}),
          ...(state !== null ? { state } : {}),
          ...(zip !== null ? { zip } : {}),
          ...(source !== null ? { source } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}
