import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { notifyMarketplaceItemDeleted } from '@/lib/email/marketplaceItemModerationEmails';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function getAuthenticatedUser(req: Request): Promise<{ id: string } | null> {
  const supabaseServer = createRouteHandlerClient({ cookies });
  const { data: { user }, error } = await supabaseServer.auth.getUser();
  if (!error && user) return user;

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;

  if (ANON_KEY) {
    const client = createClient(SUPABASE_URL!, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user: u } } = await client.auth.getUser();
    if (u) return u;
  }
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data?.user ?? null;
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const itemId = body?.itemId ?? body?.id;
    if (!itemId) {
      return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });
    }

    const { data: item, error: fetchError } = await supabaseAdmin
      .from('marketplace_items')
      .select('id, user_id, title, archived_at')
      .eq('id', itemId)
      .maybeSingle();

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    if (item.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (item.archived_at) {
      return NextResponse.json({ error: 'Item already removed' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const title = String(item.title ?? '');

    const { error: updateError } = await supabaseAdmin
      .from('marketplace_items')
      .update({ archived_at: now, archive_source: 'user' })
      .eq('id', itemId)
      .eq('user_id', user.id)
      .is('archived_at', null);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    void notifyMarketplaceItemDeleted(supabaseAdmin, {
      userId: user.id,
      itemId: String(item.id),
      listingTitle: title,
      source: 'user',
    }).catch(() => {
      console.warn('[marketplace delete-item] deletion email notify rejected');
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
