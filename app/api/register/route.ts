import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Role = 'individual' | 'business' | 'organization';

function isValidRole(role: any): role is Role {
  return role === 'individual' || role === 'business' || role === 'organization';
}

function sanitizeName(name: string) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
}

async function usernameExists(username: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('registeredaccounts')
    .select('username')
    .eq('username', username)
    .maybeSingle();

  // If DB errors, treat as exists (safe)
  if (error) return true;
  return !!data;
}

async function generateUniqueUsername(baseRaw: string): Promise<string> {
  const base = sanitizeName(baseRaw) || 'user';
  let candidate = base;

  for (let i = 0; i < 25; i++) {
    if (!(await usernameExists(candidate))) return candidate;
    const suffix = Math.floor(Math.random() * 10000);
    candidate = `${base}${suffix}`.slice(0, 20);
  }

  return `${base}${Date.now().toString().slice(-4)}`.slice(0, 20);
}

export async function POST(req: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY missing', stage: 'env' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body', stage: 'validate' }, { status: 400 });
    }

    const { name, fullName, email, password, role } = body as {
      name?: string;
      fullName?: string;
      email?: string;
      password?: string;
      role?: Role;
    };

    // Detailed missing fields
    const missing: string[] = [];
    if (!name) missing.push('name');
    if (!email) missing.push('email');
    if (!password) missing.push('password');
    if (!role) missing.push('role');

    if (missing.length) {
      return NextResponse.json(
        { error: `Missing fields: ${missing.join(', ')}`, stage: 'validate' },
        { status: 400 }
      );
    }

    if (!isValidRole(role)) {
      return NextResponse.json(
        { error: `Invalid role: ${String(role)}`, stage: 'validate' },
        { status: 400 }
      );
    }

    const safeFullName = (fullName && fullName.trim()) || String(name).trim();

    const username = await generateUniqueUsername(String(name));

    // Create auth user
    const { data, error } = await supabaseAdmin.auth.signUp({
      email: String(email),
      password: String(password),
      options: {
        data: { full_name: safeFullName, role },
      },
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || 'Signup failed', stage: 'auth' },
        { status: 400 }
      );
    }

    const user_id = data.user.id;

    // Insert app profile
    const { error: insertError } = await supabaseAdmin
      .from('registeredaccounts')
      .insert([
        {
          user_id,
          username,
          email: String(email),
          full_name: safeFullName,
          business: role === 'business',
          organization: role === 'organization',
        },
      ]);

    if (insertError) {
      // Cleanup auth user to avoid orphan accounts
      await supabaseAdmin.auth.admin.deleteUser(user_id).catch(() => null);

      return NextResponse.json(
        { error: insertError.message || 'Failed to save user profile', stage: 'db' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, username, role }, { status: 200 });
  } catch (err: any) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal Server Error', stage: 'server' }, { status: 500 });
  }
}
