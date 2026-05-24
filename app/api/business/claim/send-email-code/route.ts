import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { sendHanarEmail } from '@/lib/email/sendHanarEmail';
import { isClaimableBusiness } from '@/lib/businessClaim';
import {
  generateClaimEmailCode,
  isValidBusinessEmail,
  normalizeBusinessEmail,
} from '@/lib/businessClaimEmail';
import {
  hashClaimCode,
} from '@/lib/businessClaimVerification';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

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

/** POST: send a 6-digit verification code to the business listing email on file. */
export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: 'Sign in to claim a business.' }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { businessId?: string } | null;
    const businessId = String(body?.businessId || '').trim();
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required.' }, { status: 400 });
    }

    const { data: business, error: bizErr } = await supabaseAdmin
      .from('businesses')
      .select('id, email, owner_id, claim_status, admin_added_at, business_name')
      .eq('id', businessId)
      .maybeSingle();

    if (bizErr || !business) {
      return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
    }
    if (!isClaimableBusiness(business)) {
      return NextResponse.json({ error: 'This business already has an owner.' }, { status: 409 });
    }

    const listingEmail = normalizeBusinessEmail(business.email);
    if (!listingEmail || !isValidBusinessEmail(listingEmail)) {
      return NextResponse.json(
        { error: 'This business has no email on file. Use the contact form instead.', useContact: true },
        { status: 400 }
      );
    }

    const code = generateClaimEmailCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabaseAdmin.from('business_claim_email_verifications').insert({
      business_id: businessId,
      user_id: user.id,
      listing_email: listingEmail,
      code_hash: hashClaimCode(code),
      expires_at: expiresAt,
    });

    const businessName = business.business_name || 'your business';
    const emailResult = await sendHanarEmail({
      to: listingEmail,
      subject: `Hanar ownership verification code for ${businessName}`,
      html: `
        <p>Someone is requesting to claim <strong>${businessName}</strong> on Hanar.</p>
        <p>Your verification code is:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p>
        <p>This code expires in 15 minutes. If you did not request this, you can ignore this email.</p>
      `,
      text: `Your Hanar verification code for ${businessName} is ${code}. It expires in 15 minutes.`,
      tags: [{ name: 'template', value: 'business_claim_verification' }],
      logUserId: user.id,
    });

    if (!emailResult.success) {
      console.error('claim send-email-code:', emailResult.error);
      return NextResponse.json({ error: 'Failed to send verification email.' }, { status: 500 });
    }

    return NextResponse.json({
      sent: true,
      listingEmail,
      message: `Verification code sent to ${listingEmail}.`,
      ...(process.env.NODE_ENV !== 'production' ? { devCode: code } : {}),
    });
  } catch (err) {
    console.error('claim send-email-code error:', err);
    return NextResponse.json({ error: 'Failed to send verification email.' }, { status: 500 });
  }
}
