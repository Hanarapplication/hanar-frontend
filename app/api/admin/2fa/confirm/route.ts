import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeTotpCode, verifyTotpCode } from '@/lib/adminSecurity';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const allowedRoles = ['owner', 'ceo', 'topmanager', 'manager'];

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
    if (userError || !user?.id) {
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

    const { data: twoFaRow } = await supabaseAdmin
      .from('admin_two_factor')
      .select('totp_secret')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!twoFaRow?.totp_secret) {
      return NextResponse.json({ error: '2FA not set up' }, { status: 400 });
    }

    const valid = verifyTotpCode(twoFaRow.totp_secret, code);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('admin_two_factor')
      .update({ enabled: true, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
