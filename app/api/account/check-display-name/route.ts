import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { displayName, display_name, excludeUserId } = body as { displayName?: string; display_name?: string; excludeUserId?: string };
    const clean = typeof (displayName ?? display_name) === 'string' ? String(displayName ?? display_name).trim() : '';

    if (!clean) {
      return NextResponse.json({ available: true }); // empty is valid (will clear)
    }
    if (clean.length > 100) {
      return NextResponse.json({ available: false, error: 'Display name must be at most 100 characters' }, { status: 400 });
    }

    const [reg, org] = await Promise.all([
      supabaseAdmin.from('registeredaccounts').select('user_id').eq('full_name', clean).maybeSingle(),
      supabaseAdmin.from('organizations').select('id').eq('full_name', clean).maybeSingle(),
    ]);

    const exclude = excludeUserId?.trim();
    const takenByReg = reg.data && (!exclude || reg.data.user_id !== exclude);
    const takenByOrg = !!org.data;

    const available = !takenByReg && !takenByOrg;
    return NextResponse.json({ available });
  } catch (err) {
    console.error('[check-display-name]', err);
    return NextResponse.json({ available: false, error: 'Server error' }, { status: 500 });
  }
}
