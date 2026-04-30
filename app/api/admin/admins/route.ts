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

async function getAdminRole(): Promise<string | null> {
  const cookieStore = await cookies();
  const role = cookieStore.get('adminRole')?.value || null;
  return role && allowedRoles.includes(role) ? role : null;
}

function sanitizeName(value: unknown): string {
  return String(value ?? '').trim();
}

function sanitizeEmployeeId(value: unknown): string | null {
  const v = String(value ?? '').trim();
  return v || null;
}

function generateRandomPin(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

async function assignUniquePin(maxAttempts = 50): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const pin = generateRandomPin();
    const { data } = await supabaseAdmin
      .from('admin_pin_security')
      .select('user_id')
      .eq('pin_code', pin)
      .maybeSingle();
    if (!data?.user_id) return pin;
  }
  throw new Error('Could not generate a unique 4-digit PIN. Try again.');
}

/** GET: list all admins with role 'business' + PIN status */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [adminsRes, securityRes] = await Promise.all([
    supabaseAdmin
      .from('adminaccounts')
      .select('user_id, email, role')
      .eq('role', 'business')
      .order('email'),
    supabaseAdmin
      .from('admin_pin_security')
      .select('user_id, first_name, last_name, employee_id, pin_code, pin_failures, is_on_hold, requires_pin'),
  ]);
  const data = adminsRes.data;
  const error = adminsRes.error;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const byUserId = new Map(
    (securityRes.data || []).map((row) => [row.user_id, row as any])
  );

  return NextResponse.json({
    admins: (data || []).map((row) => ({
      user_id: row.user_id,
      email: row.email,
      role: row.role,
      label: 'Business account',
      first_name: byUserId.get(row.user_id)?.first_name || '',
      last_name: byUserId.get(row.user_id)?.last_name || '',
      employee_id: byUserId.get(row.user_id)?.employee_id || null,
      pin_code: byUserId.get(row.user_id)?.pin_code || null,
      pin_failures: byUserId.get(row.user_id)?.pin_failures || 0,
      is_on_hold: !!byUserId.get(row.user_id)?.is_on_hold,
    })),
  });
}

/** POST: add a new business account admin (email + password + profile + unique 4-digit PIN) */
export async function POST(req: Request) {
  let createdUserId: string | null = null;

  try {
    const role = await getAdminRole();
    if (!role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['owner', 'ceo', 'topmanager'].includes(role)) {
      return NextResponse.json({ error: 'Only owner-level admins can add admins.' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

    const { email, password, firstName, lastName, employeeId } = body as {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      employeeId?: string;
    };
    const safeEmail = String(email ?? '').trim().toLowerCase();
    const safePassword = String(password ?? '');
    const safeFirstName = sanitizeName(firstName);
    const safeLastName = sanitizeName(lastName);
    const safeEmployeeId = sanitizeEmployeeId(employeeId);

    if (!safeEmail || !safePassword || !safeFirstName || !safeLastName || !safeEmployeeId) {
      return NextResponse.json(
        { error: 'Email, password, first name, last name, and employee ID are required' },
        { status: 400 }
      );
    }

    if (safePassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const pinCode = await assignUniquePin();

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: safeEmail,
      password: safePassword,
      email_confirm: true,
      user_metadata: {
        role: 'business',
        admin_type: 'business_account',
        first_name: safeFirstName,
        last_name: safeLastName,
        employee_id: safeEmployeeId,
      },
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

    const { error: pinErr } = await supabaseAdmin.from('admin_pin_security').insert({
      user_id: createdUserId,
      first_name: safeFirstName,
      last_name: safeLastName,
      employee_id: safeEmployeeId,
      pin_code: pinCode,
      pin_failures: 0,
      is_on_hold: false,
      requires_pin: true,
      updated_at: new Date().toISOString(),
    });
    if (pinErr) {
      try {
        await supabaseAdmin.from('adminaccounts').delete().eq('user_id', createdUserId);
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      } catch {}
      const msg = (pinErr.message || '').toLowerCase();
      const dup = msg.includes('duplicate') || msg.includes('unique');
      return NextResponse.json(
        {
          error: dup
            ? 'Employee ID or generated PIN already exists. Try again.'
            : pinErr.message,
        },
        { status: dup ? 409 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      email: safeEmail,
      pinCode,
      message: 'Business account admin created. Share the 4-digit PIN securely with this admin.',
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

/** PATCH: owner-level reset/unhold and PIN reissue */
export async function PATCH(req: Request) {
  try {
    const role = await getAdminRole();
    if (!role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['owner', 'ceo', 'topmanager'].includes(role)) {
      return NextResponse.json({ error: 'Only owner-level admins can manage PINs.' }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as
      | { userId?: string; action?: 'reissue_pin' | 'reopen_access' | 'reissue_and_reopen' }
      | null;
    if (!body?.userId || !body.action) {
      return NextResponse.json({ error: 'Missing userId or action' }, { status: 400 });
    }

    const userId = String(body.userId).trim();
    const action = body.action;
    const { data: existing } = await supabaseAdmin
      .from('admin_pin_security')
      .select('user_id, first_name, last_name, employee_id')
      .eq('user_id', userId)
      .maybeSingle();

    let pinCode: string | null = null;
    const updatePayload: Record<string, unknown> = {
      pin_failures: 0,
      updated_at: new Date().toISOString(),
    };

    if (action === 'reopen_access' || action === 'reissue_and_reopen') {
      updatePayload.is_on_hold = false;
    }
    if (action === 'reissue_pin' || action === 'reissue_and_reopen') {
      pinCode = await assignUniquePin();
      updatePayload.pin_code = pinCode;
      updatePayload.is_on_hold = false;
    }
    if (!existing?.user_id && !pinCode) {
      pinCode = await assignUniquePin();
      updatePayload.pin_code = pinCode;
    }

    const { error } = await supabaseAdmin
      .from('admin_pin_security')
      .upsert(
        {
          user_id: userId,
          first_name: existing?.first_name || '',
          last_name: existing?.last_name || '',
          employee_id: existing?.employee_id || null,
          requires_pin: true,
          ...updatePayload,
        },
        { onConflict: 'user_id' }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      pinCode,
      message:
        action === 'reopen_access'
          ? 'Admin access reopened.'
          : action === 'reissue_pin'
            ? 'New 4-digit PIN issued.'
            : 'Admin reopened and new PIN issued.',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
