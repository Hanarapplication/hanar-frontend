import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    // ✅ Validate input
    if (!email || typeof email !== 'string') {
      console.error("❌ Missing or invalid email in request.");
      return NextResponse.json({ allowed: false, message: 'Missing or invalid email' }, { status: 400 });
    }

    // ✅ Query admin role safely
    const { data, error } = await supabase
      .from('adminaccounts')
      .select('role')
      .eq('email', email.toLowerCase())
      .maybeSingle(); // ✅ avoids crash if no row found

    console.log('📨 Email received in check-admin:', email);
    console.log('🔍 Supabase result:', data);
    console.log('❌ Supabase error:', error);

    // ✅ Check result
    if (error || !data || !data.role) {
      return NextResponse.json(
        { allowed: false, message: 'Not an admin or role missing' },
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
    return NextResponse.json({ allowed: false, message: 'Internal server error' }, { status: 500 });
  }
}
