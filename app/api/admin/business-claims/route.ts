import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAccount } from '@/lib/admin/verifyAdminAccount';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** GET: list business claims (admin). ?status=pending|approved|rejected|all */
export async function GET(req: Request) {
  try {
    const admin = await verifyAdminAccount(req, supabaseAdmin);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = new URL(req.url).searchParams.get('status') || 'pending';
    let query = supabaseAdmin
      .from('business_claims')
      .select(
        `
        id, business_id, user_id, claim_name, claim_phone, claim_email,
        proof_text, proof_image_url, status, phone_verified, email_verified,
        reviewed_by, reviewed_at, created_at,
        businesses:business_id ( id, business_name, slug, phone, email, owner_id, claim_status )
      `
      )
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ claims: data || [] });
  } catch (err) {
    console.error('admin business-claims GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
