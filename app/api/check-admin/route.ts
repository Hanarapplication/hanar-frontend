import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const allowedRoles = [
  'owner', 'ceo', 'topmanager', 'manager',
  'reviewer', 'moderator', 'support',
  'editor', 'readonly'
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

    return NextResponse.json({ allowed: true, role: data.role });
  } catch (err) {
    console.error('check-admin error:', err);
    return NextResponse.json(genericDeny, { status: 500 });
  }
}
