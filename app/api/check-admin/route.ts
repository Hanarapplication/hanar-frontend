import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import {
  getPinCookieName,
  getTwoFactorCookieName,
  validatePinCookie,
  validateTwoFactorCookie,
} from '@/lib/adminSecurity';

export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const allowedRoles = [
  'owner', 'ceo', 'topmanager', 'manager',
  'reviewer', 'moderator', 'support',
  'editor', 'readonly', 'business'
];

// In-memory rate limit: max 20 requests per minute per IP
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

async function getClientIp(): Promise<string> {
  const headersList = await headers();
  const forwarded = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');
  if (forwarded) return forwarded.split(',')[0].trim();
  if (realIp) return realIp;
  return 'unknown';
}

function rateLimit(ip: string): boolean {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
    return true;
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) return false;
  return true;
}

// Generic message to avoid revealing whether an account exists or is admin
const genericDeny = { allowed: false, message: 'Invalid credentials or access denied.' };

export async function POST(req: Request) {
  try {
    const ip = await getClientIp();
    if (!rateLimit(ip)) {
      return NextResponse.json(
        { allowed: false, message: 'Too many attempts. Try again later.' },
        { status: 429 }
      );
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return NextResponse.json(genericDeny, { status: 401 });
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json(genericDeny, { status: 403 });
    }

    const userId = user.id;
    const email = user.email?.toLowerCase() ?? '';

    let data: { role?: string } | null = null;
    if (userId) {
      const r = await supabaseAdmin.from('adminaccounts').select('role').eq('user_id', userId).maybeSingle();
      data = r.data;
    }
    if (!data?.role && email) {
      const r = await supabaseAdmin.from('adminaccounts').select('role').eq('email', email).maybeSingle();
      data = r.data;
    }

    if (!data?.role || !allowedRoles.includes(data.role)) {
      return NextResponse.json(genericDeny, { status: 403 });
    }

    const [twoFaRes, pinRes] = await Promise.all([
      supabaseAdmin.from('admin_two_factor').select('enabled').eq('user_id', userId).maybeSingle(),
      supabaseAdmin
        .from('admin_pin_security')
        .select('requires_pin, is_on_hold')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);
    const requires2fa = Boolean(twoFaRes.data?.enabled);
    const requiresPin = Boolean(pinRes.data?.requires_pin);
    const pinOnHold = Boolean(pinRes.data?.is_on_hold);
    if (pinOnHold) {
      return NextResponse.json(
        { allowed: false, requiresPin: true, pinOnHold: true, message: 'Account is on hold. Contact owner.' },
        { status: 423 }
      );
    }

    const cookieStore = await cookies();
    if (requiresPin) {
      const pinCookie = cookieStore.get(getPinCookieName())?.value;
      const pinVerified = validatePinCookie(pinCookie, userId, email);
      if (!pinVerified) {
        return NextResponse.json(
          { allowed: false, requiresPin: true, message: '4-digit security PIN is required.' },
          { status: 401 }
        );
      }
    }
    if (requires2fa) {
      const cookieValue = cookieStore.get(getTwoFactorCookieName())?.value;
      const verified = validateTwoFactorCookie(cookieValue, userId, email);
      if (!verified) {
        return NextResponse.json(
          { allowed: false, requires2fa: true, message: 'Two-factor authentication is required.' },
          { status: 401 }
        );
      }
    }

    return NextResponse.json({ allowed: true, role: data.role, requires2fa, requiresPin });
  } catch (err) {
    console.error('check-admin error:', err);
    return NextResponse.json(genericDeny, { status: 500 });
  }
}
