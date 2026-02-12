import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase env');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function getUser(req: Request): Promise<{ id: string; email?: string } | null> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;

  if (ANON_KEY) {
    const anon = createClient(SUPABASE_URL!, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await anon.auth.getUser();
    if (user) return user;
  }

  const { data } = await supabaseAdmin.auth.getUser(token);
  return data?.user ?? null;
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { entity_type, entity_id, entity_title, reason, details } = body;

    if (!entity_type || !entity_id || !reason) {
      return NextResponse.json(
        { error: 'entity_type, entity_id, and reason are required' },
        { status: 400 }
      );
    }

    const validTypes = ['post', 'item', 'business', 'organization'];
    if (!validTypes.includes(entity_type)) {
      return NextResponse.json(
        { error: 'Invalid entity_type' },
        { status: 400 }
      );
    }

    // Get reporter username
    let reporterUsername = '';
    const { data: account } = await supabaseAdmin
      .from('registeredaccounts')
      .select('username')
      .eq('user_id', user.id)
      .maybeSingle();
    if (account?.username) reporterUsername = account.username;

    // Check for duplicate report from same user on same entity
    const { data: existing } = await supabaseAdmin
      .from('reports')
      .select('id')
      .eq('entity_type', entity_type)
      .eq('entity_id', entity_id)
      .eq('reporter_id', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'You have already reported this content' },
        { status: 409 }
      );
    }

    const { data: report, error } = await supabaseAdmin.from('reports').insert({
      entity_type,
      entity_id,
      entity_title: entity_title || '',
      reporter_id: user.id,
      reporter_username: reporterUsername,
      reason,
      details: details || '',
      status: 'unread',
    }).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, report });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
