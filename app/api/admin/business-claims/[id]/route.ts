import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAccount } from '@/lib/admin/verifyAdminAccount';
import { isClaimableBusiness } from '@/lib/businessClaim';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type RouteContext = { params: Promise<{ id: string }> };

/** POST: approve or reject a claim. Body: { action: 'approve' | 'reject' } */
export async function POST(req: Request, context: RouteContext) {
  try {
    const admin = await verifyAdminAccount(req, supabaseAdmin);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const claimId = (id || '').trim();
    if (!claimId) {
      return NextResponse.json({ error: 'Missing claim id' }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as { action?: string } | null;
    const action = body?.action;
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
    }

    const { data: claim, error: fetchErr } = await supabaseAdmin
      .from('business_claims')
      .select('id, business_id, user_id, status')
      .eq('id', claimId)
      .maybeSingle();

    if (fetchErr || !claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }
    if (claim.status !== 'pending') {
      return NextResponse.json({ error: 'Claim is not pending' }, { status: 409 });
    }

    const now = new Date().toISOString();

    if (action === 'reject') {
      const { error: claimErr } = await supabaseAdmin
        .from('business_claims')
        .update({
          status: 'rejected',
          reviewed_by: admin.id,
          reviewed_at: now,
        })
        .eq('id', claimId);

      if (claimErr) {
        return NextResponse.json({ error: claimErr.message }, { status: 500 });
      }

      await supabaseAdmin
        .from('businesses')
        .update({ claim_status: 'unclaimed', updated_at: now })
        .eq('id', claim.business_id);

      return NextResponse.json({ success: true, status: 'rejected' });
    }

    if (!claim.user_id) {
      return NextResponse.json({ error: 'Claim has no user to assign as owner.' }, { status: 400 });
    }

    const { data: business, error: bizErr } = await supabaseAdmin
      .from('businesses')
      .select('id, owner_id, admin_added_at, claim_status')
      .eq('id', claim.business_id)
      .maybeSingle();

    if (bizErr || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    if (!isClaimableBusiness(business)) {
      return NextResponse.json({ error: 'Business already has an owner.' }, { status: 409 });
    }

    const previousOwnerId = business.owner_id;

    const { error: bizUpdateErr } = await supabaseAdmin
      .from('businesses')
      .update({
        owner_id: claim.user_id,
        claim_status: 'claimed',
        claimed_at: now,
        updated_at: now,
      })
      .eq('id', claim.business_id);

    if (bizUpdateErr) {
      return NextResponse.json({ error: bizUpdateErr.message }, { status: 500 });
    }

    // Remove placeholder auth account created for admin-added listings.
    if (business.admin_added_at && previousOwnerId && previousOwnerId !== claim.user_id) {
      try {
        await supabaseAdmin.from('registeredaccounts').delete().eq('user_id', previousOwnerId);
      } catch {
        /* non-blocking */
      }
      try {
        await supabaseAdmin.auth.admin.deleteUser(previousOwnerId);
      } catch {
        /* non-blocking */
      }
    }

    const { error: claimErr } = await supabaseAdmin
      .from('business_claims')
      .update({
        status: 'approved',
        reviewed_by: admin.id,
        reviewed_at: now,
      })
      .eq('id', claimId);

    if (claimErr) {
      return NextResponse.json({ error: claimErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: 'approved' });
  } catch (err) {
    console.error('admin business-claims review:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
