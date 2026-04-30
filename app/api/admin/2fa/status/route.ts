import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getTwoFactorCookieName, validateTwoFactorCookie } from '@/lib/adminSecurity';

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

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user?.id || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [adminRes, twoFaRes] = await Promise.all([
      supabaseAdmin.from('adminaccounts').select('role').eq('user_id', user.id).maybeSingle(),
      supabaseAdmin.from('admin_two_factor').select('enabled').eq('user_id', user.id).maybeSingle(),
    ]);
    const role = adminRes.data?.role || null;
    if (!role || !allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const store = await cookies();
    const cookieValue = store.get(getTwoFactorCookieName())?.value;
    const verified = validateTwoFactorCookie(cookieValue, user.id, user.email);
    const enabled = Boolean(twoFaRes.data?.enabled);

    return NextResponse.json({ enabled, verified, required: enabled, role });
  } catch {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
