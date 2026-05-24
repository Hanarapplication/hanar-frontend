import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAccount } from '@/lib/admin/verifyAdminAccount';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** GET: contact form inbox for business claim requests. ?status=pending|reviewed|closed|all&source=business_claim|all */
export async function GET(req: Request) {
  try {
    const admin = await verifyAdminAccount(req, supabaseAdmin);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'pending';
    const source = url.searchParams.get('source') || 'business_claim';

    let query = supabaseAdmin
      .from('contact_submissions')
      .select(
        `
        id, name, email, phone, subject, message,
        business_id, business_name, business_slug, source, status, created_at,
        businesses:business_id ( id, business_name, slug, email, phone, owner_id, claim_status, admin_added_at )
      `
      )
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }
    if (source !== 'all') {
      query = query.eq('source', source);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ submissions: data || [] });
  } catch (err) {
    console.error('admin business-claims inbox GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
