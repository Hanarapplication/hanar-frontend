import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const allowedRoles = [
  'owner', 'ceo', 'topmanager', 'manager',
  'reviewer', 'moderator', 'support', 'editor', 'readonly',
];

function sanitizeName(name: string) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
}

async function usernameExists(username: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('registeredaccounts')
    .select('username')
    .eq('username', username)
    .maybeSingle();
  return !!data;
}

async function orgUsernameExists(username: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('username')
    .eq('username', username)
    .maybeSingle();
  return !!data;
}

async function generateUniqueUsername(baseRaw: string): Promise<string> {
  const base = sanitizeName(baseRaw) || 'org';
  let candidate = base;
  for (let i = 0; i < 25; i++) {
    if (!(await usernameExists(candidate)) && !(await orgUsernameExists(candidate))) return candidate;
    candidate = `${base}${Math.floor(Math.random() * 10000)}`.slice(0, 20);
  }
  return `${base}${Date.now().toString().slice(-4)}`.slice(0, 20);
}

async function verifyAdmin(req: Request): Promise<{ id: string; email: string } | null> {
  let user: { id: string; email?: string } | null = null;

  const supabaseServer = createRouteHandlerClient({ cookies });
  const { data: { user: cookieUser }, error } = await supabaseServer.auth.getUser();
  if (!error && cookieUser) user = cookieUser;

  if (!user && req) {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (token && ANON_KEY) {
      const supabaseAnon = createClient(SUPABASE_URL!, ANON_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user: tokenUser } } = await supabaseAnon.auth.getUser();
      if (tokenUser) user = tokenUser;
    }
    if (!user && token) {
      const { data } = await supabaseAdmin.auth.getUser(token);
      if (data?.user) user = data.user;
    }
  }

  if (!user?.id || !user?.email) return null;

  let { data: adminData } = await supabaseAdmin.from('adminaccounts').select('role').eq('user_id', user.id).maybeSingle();
  if (!adminData && user.email) {
    const r = await supabaseAdmin.from('adminaccounts').select('role').eq('email', user.email.toLowerCase()).maybeSingle();
    adminData = r.data;
  }

  if (!adminData?.role || !allowedRoles.includes(adminData.role)) return null;
  return { id: user.id, email: user.email };
}

export async function POST(req: Request) {
  let createdUserId: string | null = null;

  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

    const { full_name, email, password } = body as {
      full_name?: string;
      email?: string;
      password?: string;
    };

    const safeEmail = String(email || '').trim().toLowerCase();
    const safeFullName = String(full_name || '').trim();
    const safePassword = String(password || '');

    if (!safeEmail || !safeFullName || !safePassword) {
      return NextResponse.json(
        { error: 'full_name, email, and password are required' },
        { status: 400 }
      );
    }

    const username = await generateUniqueUsername(safeFullName);

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: safeEmail,
      password: safePassword,
      email_confirm: true,
      user_metadata: { full_name: safeFullName, role: 'organization' },
    });

    if (createErr) {
      const msg = (createErr.message || '').toLowerCase();
      const isDup = msg.includes('already') || msg.includes('registered') || msg.includes('exists');
      return NextResponse.json(
        { error: isDup ? 'An account with this email already exists' : createErr.message },
        { status: isDup ? 409 : 400 }
      );
    }

    createdUserId = created.user.id;

    const { error: regErr } = await supabaseAdmin.from('registeredaccounts').insert({
      user_id: createdUserId,
      username,
      email: safeEmail,
      full_name: safeFullName,
      business: false,
      organization: true,
    });

    if (regErr) {
      try { await supabaseAdmin.auth.admin.deleteUser(createdUserId); } catch {}
      return NextResponse.json(
        { error: regErr.message || 'Failed to save registered account' },
        { status: 500 }
      );
    }

    const { error: orgErr } = await supabaseAdmin.from('organizations').insert({
      user_id: createdUserId,
      username,
      email: safeEmail,
      full_name: safeFullName,
      admin_added_at: new Date().toISOString(),
      admin_added_by: admin.id,
    });

    if (orgErr) {
      try { await supabaseAdmin.from('registeredaccounts').delete().eq('user_id', createdUserId); } catch {}
      try { await supabaseAdmin.auth.admin.deleteUser(createdUserId); } catch {}
      return NextResponse.json(
        { error: orgErr.message || 'Failed to create organization' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      username,
    });
  } catch (err) {
    console.error('admin create-organization error:', err);
    if (createdUserId) {
      try { await supabaseAdmin.auth.admin.deleteUser(createdUserId); } catch {}
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
