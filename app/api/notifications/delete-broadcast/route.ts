import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL');
if (!SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type Payload = {
  businessId: string;
  kind: 'follower_update' | 'area_blast';
  title: string;
  body: string;
  createdAt: string;
};

export async function POST(req: Request) {
  try {
    const supabaseServer = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = (await req.json()) as Payload;
    const businessId = String(payload.businessId || '').trim();
    const kind = payload.kind === 'area_blast' ? 'area_blast' : 'follower_update';
    const title = String(payload.title || '').trim();
    const body = String(payload.body || '').trim();
    const createdAtRaw = String(payload.createdAt || '').trim();

    if (!businessId || !title || !body || !createdAtRaw) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: business, error: businessError } = await supabaseAdmin
      .from('businesses')
      .select('id, owner_id')
      .eq('id', businessId)
      .single();
    if (businessError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    if (business.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const createdAt = new Date(createdAtRaw);
    if (Number.isNaN(createdAt.getTime())) {
      return NextResponse.json({ error: 'Invalid createdAt' }, { status: 400 });
    }
    const windowMs = 5 * 60 * 1000;
    const from = new Date(createdAt.getTime() - windowMs).toISOString();
    const to = new Date(createdAt.getTime() + windowMs).toISOString();

    if (kind === 'area_blast') {
      const { error: outboxError } = await supabaseAdmin
        .from('area_blast_outbox')
        .delete()
        .eq('business_id', businessId)
        .eq('title', title)
        .eq('body', body)
        .gte('created_at', from)
        .lte('created_at', to);
      if (outboxError) {
        return NextResponse.json({ error: outboxError.message }, { status: 500 });
      }
    }

    const targetType = kind === 'area_blast' ? 'area_blast' : 'business_update';
    const { error: notifError } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('type', targetType)
      .eq('title', title)
      .eq('body', body)
      .contains('data', { business_id: businessId })
      .gte('created_at', from)
      .lte('created_at', to);
    if (notifError) {
      return NextResponse.json({ error: notifError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}
