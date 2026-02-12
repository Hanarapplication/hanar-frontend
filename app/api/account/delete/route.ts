import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Hanar <onboarding@resend.dev>';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function getAuthenticatedUser(req: Request): Promise<{ id: string; email?: string | null } | null> {
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
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    const otherText = typeof body?.otherText === 'string' ? body.otherText.trim().slice(0, 500) : '';

    if (!reason) {
      return NextResponse.json({ error: 'Please select a reason for deleting your account.' }, { status: 400 });
    }

    // Log feedback for product/improvement (optional; can be sent to a table later)
    console.info('[account/delete]', { userId: user.id, reason, otherText: otherText || undefined });

    const userId = user.id;
    const userEmail = (user.email || '').trim().toLowerCase();

    // Get display name for goodbye email (before we delete registeredaccounts)
    let userName = '';
    const { data: regRow } = await supabaseAdmin
      .from('registeredaccounts')
      .select('full_name, username')
      .eq('user_id', userId)
      .maybeSingle();
    if (regRow?.full_name?.trim()) userName = regRow.full_name.trim();
    else if (regRow?.username?.trim()) userName = regRow.username.trim();

    // Cleanup order: profiles, business row, organization row, registered account, then auth
    // 1) Profiles (individuals and possibly others)
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    // 2) Business row if this user is a business owner
    await supabaseAdmin.from('businesses').delete().eq('owner_id', userId);

    // 3) Organization row if this user is an organization
    await supabaseAdmin.from('organizations').delete().eq('user_id', userId);

    // 4) Registered account
    await supabaseAdmin.from('registeredaccounts').delete().eq('user_id', userId);

    // 5) Auth user (must be last)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error('[account/delete] auth delete failed:', deleteAuthError.message);
      return NextResponse.json(
        { error: deleteAuthError.message || 'Failed to delete account. Please contact support.' },
        { status: 500 }
      );
    }

    // 6) Send goodbye email (non-blocking; don't fail the request if send fails)
    if (userEmail && resend) {
      const subject = userName
        ? `We're sorry to see you go, ${userName}`
        : "We're sorry to see you go";
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e293b;">We're sorry to see you go${userName ? `, ${userName}` : ''}</h2>
          <p>Your Hanar account has been deleted.</p>
          <p>We're sorry we didn't meet your expectations. You can still use Hanar anytime as a visitor. You can browse community posts, discover local businesses, and explore marketplace listings without creating an account.</p>
          <p>If you ever decide to return, you are always welcome to create a new account.</p>
          <p>Hanar Team</p>
        </div>
      `;
      resend.emails.send({
        from: EMAIL_FROM,
        to: userEmail,
        subject,
        html,
      }).catch((err) => console.error('[account/delete] goodbye email failed:', err));
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    console.error('[account/delete]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
