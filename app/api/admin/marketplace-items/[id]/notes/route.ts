import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAccount } from '@/lib/admin/verifyAdminAccount';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const MAX_NOTE = 8000;

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteCtx) {
  try {
    const admin = await verifyAdminAccount(req, supabaseAdmin);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: itemId } = await context.params;
    if (!itemId?.trim()) {
      return NextResponse.json({ error: 'Missing item id' }, { status: 400 });
    }

    const { data: item, error: itemErr } = await supabaseAdmin
      .from('marketplace_items')
      .select('id')
      .eq('id', itemId)
      .maybeSingle();
    if (itemErr || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const { data: notes, error } = await supabaseAdmin
      .from('marketplace_item_admin_notes')
      .select('id, body, created_at, admin_user_id, admin_email')
      .eq('marketplace_item_id', itemId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notes: notes || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request, context: RouteCtx) {
  try {
    const admin = await verifyAdminAccount(req, supabaseAdmin);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: itemId } = await context.params;
    if (!itemId?.trim()) {
      return NextResponse.json({ error: 'Missing item id' }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as { body?: string } | null;
    const text = typeof body?.body === 'string' ? body.body.trim() : '';
    if (!text) {
      return NextResponse.json({ error: 'Note text is required' }, { status: 400 });
    }
    if (text.length > MAX_NOTE) {
      return NextResponse.json({ error: `Note must be at most ${MAX_NOTE} characters` }, { status: 400 });
    }

    const { data: item, error: itemErr } = await supabaseAdmin
      .from('marketplace_items')
      .select('id')
      .eq('id', itemId)
      .maybeSingle();
    if (itemErr || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const { data: row, error } = await supabaseAdmin
      .from('marketplace_item_admin_notes')
      .insert({
        marketplace_item_id: itemId,
        admin_user_id: admin.id,
        admin_email: admin.email.toLowerCase(),
        body: text,
      })
      .select('id, body, created_at, admin_user_id, admin_email')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ note: row });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
