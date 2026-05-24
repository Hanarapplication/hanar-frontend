import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { isClaimableBusiness } from '@/lib/businessClaim';
import { normalizeBusinessEmail } from '@/lib/businessClaimEmail';
import {
  createClaimEmailCookieValue,
  getClaimEmailCookieMaxAge,
  getClaimEmailCookieName,
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

/** POST: verify 6-digit email code for business claim. */
export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user?.id) {
      return NextResponse.json({ error: 'Sign in to claim a business.' }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as {
      businessId?: string;
      code?: string;
    } | null;

    const businessId = String(body?.businessId || '').trim();
    const code = String(body?.code || '').replace(/\s+/g, '').trim();

    if (!businessId || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Business id and 6-digit code are required.' }, { status: 400 });
    }

    const { data: business, error: bizErr } = await supabaseAdmin
      .from('businesses')
      .select('id, email, owner_id, claim_status, admin_added_at')
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
      return NextResponse.json({ error: 'Business has no email on file.' }, { status: 400 });
    }

    const { data: rows } = await supabaseAdmin
      .from('business_claim_email_verifications')
      .select('id, code_hash, expires_at')
      .eq('business_id', businessId)
      .eq('user_id', user.id)
      .eq('listing_email', listingEmail)
      .is('verified_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    const row = rows?.[0];
    if (!row || row.code_hash !== hashClaimCode(code)) {
      return NextResponse.json({ error: 'Invalid or expired verification code.' }, { status: 400 });
    }

    await supabaseAdmin
      .from('business_claim_email_verifications')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', row.id);

    const response = NextResponse.json({ verified: true, message: 'Email verified.' });
    response.cookies.set({
      name: getClaimEmailCookieName(businessId),
      value: createClaimEmailCookieValue(businessId, user.id, listingEmail),
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: getClaimEmailCookieMaxAge(),
    });
    return response;
  } catch (err) {
    console.error('claim verify-email-code error:', err);
    return NextResponse.json({ error: 'Verification failed.' }, { status: 500 });
  }
}
