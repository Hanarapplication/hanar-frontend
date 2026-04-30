import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const MAX_FAILURES = 5;
const LOCKOUT_MINUTES = 30;

function normalizeEmail(input: unknown): string {
  return String(input ?? '').trim().toLowerCase();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = normalizeEmail(searchParams.get('email'));
    if (!email) return NextResponse.json({ locked: false, lockoutUntil: null });

    const { data } = await supabaseAdmin
      .from('admin_login_security')
      .select('lockout_until')
      .eq('email', email)
      .maybeSingle();

    const lockoutUntil = data?.lockout_until || null;
    const locked = !!lockoutUntil && new Date(lockoutUntil).getTime() > Date.now();
    return NextResponse.json({ locked, lockoutUntil });
  } catch {
    return NextResponse.json({ locked: false, lockoutUntil: null });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string; success?: boolean };
    const email = normalizeEmail(body.email);
    const success = Boolean(body.success);
    if (!email) return NextResponse.json({ ok: false }, { status: 400 });

    if (success) {
      await supabaseAdmin
        .from('admin_login_security')
        .upsert(
          {
            email,
            failure_count: 0,
            lockout_until: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email' }
        );
      return NextResponse.json({ ok: true, locked: false, lockoutUntil: null });
    }

    const { data: existing } = await supabaseAdmin
      .from('admin_login_security')
      .select('failure_count, lockout_until')
      .eq('email', email)
      .maybeSingle();

    const activeLock = existing?.lockout_until ? new Date(existing.lockout_until) : null;
    if (activeLock && activeLock.getTime() > Date.now()) {
      return NextResponse.json({ ok: true, locked: true, lockoutUntil: activeLock.toISOString() });
    }

    const failureCount = (existing?.failure_count || 0) + 1;
    const lockoutUntil =
      failureCount >= MAX_FAILURES
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
        : null;

    await supabaseAdmin
      .from('admin_login_security')
      .upsert(
        {
          email,
          failure_count: failureCount,
          lockout_until: lockoutUntil,
          last_failure_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      );

    return NextResponse.json({
      ok: true,
      locked: !!lockoutUntil,
      lockoutUntil,
      remainingAttempts: Math.max(0, MAX_FAILURES - failureCount),
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
