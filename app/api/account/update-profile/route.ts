import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const DISPLAY_NAME_MAX = 100;

async function getAuthenticatedUser(req: Request): Promise<{ id: string } | null> {
  const supabaseServer = createRouteHandlerClient({ cookies });
  const { data: { user }, error } = await supabaseServer.auth.getUser();
  if (!error && user) return user;

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;

  if (ANON_KEY && SUPABASE_URL) {
    const client = createClient(SUPABASE_URL, ANON_KEY, {
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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const { username, displayName } = body as { username?: string; displayName?: string };

    const { data: reg } = await supabaseAdmin
      .from('registeredaccounts')
      .select('user_id, username, full_name, business, organization')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!reg) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    if (reg.business === true || reg.organization === true) {
      return NextResponse.json({ error: 'Only individual accounts can update profile here' }, { status: 403 });
    }

    const updates: { username?: string; full_name?: string | null } = {};
    let updateUsername = false;
    let updateDisplayName = false;

    if (username !== undefined) {
      const clean = String(username).trim().toLowerCase().replace(/^@/, '');
      if (clean.length < USERNAME_MIN) {
        return NextResponse.json({ error: `Username must be at least ${USERNAME_MIN} characters` }, { status: 400 });
      }
      if (clean.length > USERNAME_MAX) {
        return NextResponse.json({ error: `Username must be at most ${USERNAME_MAX} characters` }, { status: 400 });
      }
      if (!/^[a-z0-9_.]+$/.test(clean)) {
        return NextResponse.json({ error: 'Username can only contain letters, numbers, underscores, and periods' }, { status: 400 });
      }
      if (clean !== (reg.username || '').toLowerCase()) {
        const [inReg, inProf, inOrg, inBiz] = await Promise.all([
          supabaseAdmin.from('registeredaccounts').select('user_id').eq('username', clean).maybeSingle(),
          supabaseAdmin.from('profiles').select('id').eq('username', clean).maybeSingle(),
          supabaseAdmin.from('organizations').select('id').eq('username', clean).maybeSingle(),
          supabaseAdmin.from('businesses').select('id').eq('slug', clean).maybeSingle(),
        ]);
        if (inReg.data && inReg.data.user_id !== user.id) {
          return NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
        }
        if (inProf.data && inProf.data.id !== user.id) {
          return NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
        }
        if (inOrg.data) {
          return NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
        }
        if (inBiz.data) {
          return NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
        }
        updates.username = clean;
        updateUsername = true;
      }
    }

    if (displayName !== undefined) {
      const clean = String(displayName).trim();
      if (clean.length > DISPLAY_NAME_MAX) {
        return NextResponse.json({ error: `Display name must be at most ${DISPLAY_NAME_MAX} characters` }, { status: 400 });
      }
      const currentDisplay = (reg.full_name || '').trim();
      if (clean !== currentDisplay) {
        if (clean) {
          const [inReg, inOrg] = await Promise.all([
            supabaseAdmin.from('registeredaccounts').select('user_id').eq('full_name', clean).maybeSingle(),
            supabaseAdmin.from('organizations').select('id').eq('full_name', clean).maybeSingle(),
          ]);
          if (inReg.data && inReg.data.user_id !== user.id) {
            return NextResponse.json({ error: 'Display name is already used by another account' }, { status: 400 });
          }
          if (inOrg.data) {
            return NextResponse.json({ error: 'Display name is already used by another account' }, { status: 400 });
          }
        }
        updates.full_name = clean || null;
        updateDisplayName = true;
      }
    }

    if (!updateUsername && !updateDisplayName) {
      return NextResponse.json({ success: true });
    }

    if (updateUsername || updateDisplayName) {
      const regUpdate: Record<string, unknown> = {};
      if (updates.username !== undefined) regUpdate.username = updates.username;
      if (updates.full_name !== undefined) regUpdate.full_name = updates.full_name;
      if (Object.keys(regUpdate).length > 0) {
        const { error: regErr } = await supabaseAdmin
          .from('registeredaccounts')
          .update(regUpdate)
          .eq('user_id', user.id);
        if (regErr) {
          return NextResponse.json({ error: regErr.message }, { status: 500 });
        }
      }

      if (updateUsername && updates.username) {
        const { error: profErr } = await supabaseAdmin
          .from('profiles')
          .upsert({ id: user.id, username: updates.username }, { onConflict: 'id' });
        if (profErr) {
          return NextResponse.json({ error: profErr.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[update-profile]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
