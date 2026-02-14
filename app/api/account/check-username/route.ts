import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { username, excludeUserId, excludeOrgUserId } = body as { username?: string; excludeUserId?: string; excludeOrgUserId?: string };
    const clean = typeof username === 'string' ? username.trim().toLowerCase().replace(/^@/, '') : '';

    if (!clean || clean.length < 3) {
      return NextResponse.json({ available: false, error: 'Username must be at least 3 characters' }, { status: 400 });
    }
    if (clean.length > 30) {
      return NextResponse.json({ available: false, error: 'Username must be at most 30 characters' }, { status: 400 });
    }
    if (!/^[a-z0-9_.]+$/.test(clean)) {
      return NextResponse.json({ available: false, error: 'Username can only contain letters, numbers, underscores, and periods' }, { status: 400 });
    }

    const [reg, prof, org, biz] = await Promise.all([
      supabaseAdmin.from('registeredaccounts').select('user_id').eq('username', clean).maybeSingle(),
      supabaseAdmin.from('profiles').select('id').eq('username', clean).maybeSingle(),
      supabaseAdmin.from('organizations').select('user_id').eq('username', clean).maybeSingle(),
      supabaseAdmin.from('businesses').select('id').eq('slug', clean).maybeSingle(),
    ]);

    const exclude = excludeUserId?.trim();
    const excludeOrg = excludeOrgUserId?.trim();
    const takenByReg = reg.data && (!exclude || reg.data.user_id !== exclude);
    const takenByProf = prof.data && (!exclude || prof.data.id !== exclude);
    const takenByOrg = org.data && (!excludeOrg || (org.data as { user_id: string }).user_id !== excludeOrg);
    const takenByBiz = !!biz.data;

    const available = !takenByReg && !takenByProf && !takenByOrg && !takenByBiz;
    return NextResponse.json({ available });
  } catch (err) {
    console.error('[check-username]', err);
    return NextResponse.json({ available: false, error: 'Server error' }, { status: 500 });
  }
}
