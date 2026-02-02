import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const { user_id, email } = await req.json();

    // Prefer user_id (best). Fallback to email if you must.
    const safeUserId = typeof user_id === 'string' ? user_id.trim() : '';
    const safeEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!safeUserId && !safeEmail) {
      return NextResponse.json(
        { allowed: false, message: 'Missing user_id or email' },
        { status: 400 }
      );
    }

    const query = supabaseAdmin.from('adminaccounts').select('role, user_id, email');

    const { data, error } = safeUserId
      ? await query.eq('user_id', safeUserId).maybeSingle()
      : await query.eq('email', safeEmail).maybeSingle();

    if (error || !data?.role) {
      return NextResponse.json(
        { allowed: false, message: 'Not an admin' },
        { status: 403 }
      );
    }

    const allowedRoles = [
      'owner', 'ceo', 'topmanager', 'manager',
      'reviewer', 'moderator', 'support',
      'editor', 'readonly'
    ];

    if (!allowedRoles.includes(data.role)) {
      return NextResponse.json(
        { allowed: false, message: 'Role not allowed: ' + data.role },
        { status: 403 }
      );
    }

    return NextResponse.json({ allowed: true, role: data.role });
  } catch (err) {
    console.error('🔥 API error in check-admin:', err);
    return NextResponse.json(
      { allowed: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
