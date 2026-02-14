import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const allowedRoles = [
  'owner', 'ceo', 'topmanager', 'manager',
  'reviewer', 'moderator', 'support', 'editor', 'readonly', 'business',
];

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const role = cookieStore.get('adminRole')?.value;
  return !!role && allowedRoles.includes(role);
}

/** GET: list all admins with role 'business' (business accounts) */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('adminaccounts')
    .select('user_id, email, role')
    .eq('role', 'business')
    .order('email');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    admins: (data || []).map((row) => ({
      user_id: row.user_id,
      email: row.email,
      role: row.role,
      label: 'Business account',
    })),
  });
}

/** POST: add a new business account admin (email + password) */
export async function POST(req: Request) {
  let createdUserId: string | null = null;

  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

    const { email, password } = body as { email?: string; password?: string };
    const safeEmail = String(email ?? '').trim().toLowerCase();
    const safePassword = String(password ?? '');

    if (!safeEmail || !safePassword) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (safePassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: safeEmail,
      password: safePassword,
      email_confirm: true,
      user_metadata: { role: 'business', admin_type: 'business_account' },
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

    const { error: insertErr } = await supabaseAdmin.from('adminaccounts').insert({
      user_id: createdUserId,
      email: safeEmail,
      role: 'business',
    });

    if (insertErr) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      } catch {}
      return NextResponse.json(
        { error: insertErr.message || 'Failed to add admin account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      email: safeEmail,
      message: 'Business account admin created. They can sign in at the admin login page.',
    });
  } catch (err) {
    if (createdUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      } catch {}
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
