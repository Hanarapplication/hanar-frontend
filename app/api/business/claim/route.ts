import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import {
  getClaimEmailCookieName,
  validateClaimEmailCookie,
} from '@/lib/businessClaimVerification';
import { isClaimableBusiness } from '@/lib/businessClaim';
import { normalizeBusinessEmail } from '@/lib/businessClaimEmail';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const PROOF_BUCKET = 'business-claim-proofs';
const MAX_PROOF_BYTES = 10 * 1024 * 1024;

async function getAuthUser(req: Request) {
  const supabaseServer = createRouteHandlerClient({ cookies });
  const { data: { user }, error } = await supabaseServer.auth.getUser();
  if (!error && user) return user;

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;

  const { data } = await supabaseAdmin.auth.getUser(token);
  return data?.user ?? null;
}

/** POST: submit a business claim after listing email verification. */
export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: 'Sign in to claim a business.' }, { status: 401 });
    }

    const formData = await req.formData();
    const businessId = String(formData.get('businessId') || '').trim();
    const claimName = String(formData.get('claimName') || '').trim();
    const claimPhone = String(formData.get('claimPhone') || '').trim() || null;
    const claimEmail = String(formData.get('claimEmail') || user.email || '').trim() || null;
    const proofText = String(formData.get('proofText') || '').trim();
    const proofFile = formData.get('proofFile');

    if (!businessId || !claimName || !claimPhone) {
      return NextResponse.json({ error: 'Business, name, and phone are required.' }, { status: 400 });
    }
    if (!claimEmail) {
      return NextResponse.json({ error: 'Your email is required.' }, { status: 400 });
    }
    const phoneDigits = claimPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return NextResponse.json({ error: 'Enter a valid phone number (at least 10 digits).' }, { status: 400 });
    }
    if (proofText.length < 20) {
      return NextResponse.json(
        { error: 'Please explain why you own or manage this business (at least 20 characters).' },
        { status: 400 }
      );
    }

    const { data: business, error: bizErr } = await supabaseAdmin
      .from('businesses')
      .select('id, owner_id, claim_status, admin_added_at, email')
      .eq('id', businessId)
      .maybeSingle();

    if (bizErr || !business) {
      return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
    }
    if (!isClaimableBusiness(business)) {
      return NextResponse.json({ error: 'This business already has an owner.' }, { status: 409 });
    }

    const listingEmail = normalizeBusinessEmail(business.email);
    if (!listingEmail) {
      return NextResponse.json(
        { error: 'This business has no email on file. Use the contact form instead.', useContact: true },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const emailCookie = cookieStore.get(getClaimEmailCookieName(businessId))?.value;
    if (!validateClaimEmailCookie(emailCookie, businessId, user.id, listingEmail)) {
      return NextResponse.json(
        { error: 'Verify the listing email before submitting a claim.' },
        { status: 403 }
      );
    }

    const { data: pendingClaim } = await supabaseAdmin
      .from('business_claims')
      .select('id')
      .eq('business_id', businessId)
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingClaim?.id) {
      return NextResponse.json({ error: 'A claim is already pending review for this business.' }, { status: 409 });
    }

    let proofImageUrl: string | null = null;
    if (proofFile instanceof File && proofFile.size > 0) {
      if (proofFile.size > MAX_PROOF_BYTES) {
        return NextResponse.json({ error: 'Proof file must be 10 MB or smaller.' }, { status: 400 });
      }
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
      if (!allowed.includes(proofFile.type)) {
        return NextResponse.json({ error: 'Proof must be an image or PDF.' }, { status: 400 });
      }
      const ext = proofFile.name.split('.').pop()?.toLowerCase() || 'bin';
      const path = `${user.id}/${businessId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const buffer = Buffer.from(await proofFile.arrayBuffer());
      const { error: uploadErr } = await supabaseAdmin.storage
        .from(PROOF_BUCKET)
        .upload(path, buffer, { contentType: proofFile.type, upsert: false });
      if (uploadErr) {
        return NextResponse.json({ error: 'Failed to upload proof document.' }, { status: 500 });
      }
      proofImageUrl = `${SUPABASE_URL}/storage/v1/object/public/${PROOF_BUCKET}/${path}`;
    }

    const { data: claim, error: insertErr } = await supabaseAdmin
      .from('business_claims')
      .insert({
        business_id: businessId,
        user_id: user.id,
        claim_name: claimName,
        claim_phone: claimPhone,
        claim_email: claimEmail,
        proof_text: proofText,
        proof_image_url: proofImageUrl,
        status: 'pending',
        email_verified: true,
        phone_verified: false,
      })
      .select('id')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message || 'Failed to save claim.' }, { status: 500 });
    }

    await supabaseAdmin
      .from('businesses')
      .update({ claim_status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', businessId);

    return NextResponse.json({
      success: true,
      claimId: claim.id,
      message: 'Claim submitted. An admin will review your request.',
    });
  } catch (err) {
    console.error('business claim submit error:', err);
    return NextResponse.json({ error: 'Failed to submit claim.' }, { status: 500 });
  }
}

/** GET: current user's claim status for a business (?businessId=) */
export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user?.id) {
      return NextResponse.json({ claim: null });
    }

    const businessId = new URL(req.url).searchParams.get('businessId')?.trim();
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    const { data } = await supabaseAdmin
      .from('business_claims')
      .select('id, status, created_at')
      .eq('business_id', businessId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ claim: data ?? null });
  } catch {
    return NextResponse.json({ claim: null });
  }
}
