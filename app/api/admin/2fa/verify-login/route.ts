import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  createTwoFactorCookieValue,
  getTwoFactorCookieMaxAge,
  getTwoFactorCookieName,
  normalizeTotpCode,
  verifyTotpCode,
} from '@/lib/adminSecurity';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const allowedRoles = [
  'owner',
  'ceo',
  'topmanager',
  'manager',
  'reviewer',
  'moderator',
  'support',
  'editor',
  'readonly',
  'business',
];

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = (await req.json().catch(() => ({}))) as { code?: string };
    const code = normalizeTotpCode(payload.code);
    if (!code) return NextResponse.json({ error: 'Code is required' }, { status: 400 });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user?.id || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [adminRes, twoFaRes] = await Promise.all([
      supabaseAdmin.from('adminaccounts').select('role').eq('user_id', user.id).maybeSingle(),
      supabaseAdmin
        .from('admin_two_factor')
        .select('totp_secret, enabled')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);
    const role = adminRes.data?.role || '';
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!twoFaRes.data?.enabled || !twoFaRes.data?.totp_secret) {
      return NextResponse.json({ error: '2FA is not enabled' }, { status: 400 });
    }

    if (!verifyTotpCode(twoFaRes.data.totp_secret, code)) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true, role });
    response.cookies.set({
      name: getTwoFactorCookieName(),
      value: createTwoFactorCookieValue(user.id, user.email),
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: getTwoFactorCookieMaxAge(),
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
