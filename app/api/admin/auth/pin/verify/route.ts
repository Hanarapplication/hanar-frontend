import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  createPinCookieValue,
  getPinCookieName,
  getTwoFactorCookieMaxAge,
} from '@/lib/adminSecurity';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const MAX_PIN_FAILURES = 3;

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

function normalizePin(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, '').trim();
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = (await req.json().catch(() => ({}))) as { pin?: string };
    const pin = normalizePin(payload.pin);
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be 4 digits.' }, { status: 400 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user?.id || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminData } = await supabaseAdmin
      .from('adminaccounts')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    const role = adminData?.role || '';
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: securityRow } = await supabaseAdmin
      .from('admin_pin_security')
      .select('pin_code, pin_failures, is_on_hold, requires_pin')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!securityRow || !securityRow.requires_pin) {
      return NextResponse.json({ ok: true, role, pinRequired: false });
    }
    if (securityRow.is_on_hold) {
      return NextResponse.json(
        { error: 'Account is on hold. Contact owner to reset your access PIN.' },
        { status: 423 }
      );
    }

    if (securityRow.pin_code !== pin) {
      const nextFailures = (securityRow.pin_failures || 0) + 1;
      const onHold = nextFailures >= MAX_PIN_FAILURES;
      await supabaseAdmin
        .from('admin_pin_security')
        .update({
          pin_failures: nextFailures,
          is_on_hold: onHold,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
      return NextResponse.json(
        {
          error: onHold
            ? 'Too many incorrect PIN attempts. Account placed on hold.'
            : 'Incorrect PIN.',
          attemptsLeft: Math.max(0, MAX_PIN_FAILURES - nextFailures),
          onHold,
        },
        { status: 400 }
      );
    }

    await supabaseAdmin
      .from('admin_pin_security')
      .update({
        pin_failures: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    const response = NextResponse.json({ ok: true, role, pinRequired: true });
    response.cookies.set({
      name: getPinCookieName(),
      value: createPinCookieValue(user.id, user.email),
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
