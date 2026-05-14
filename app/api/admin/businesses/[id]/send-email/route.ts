import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { sendHanarEmail } from '@/lib/email/sendHanarEmail';
import { resolveBusinessContactEmail } from '@/lib/email/resolveBusinessContactEmail';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** Must match a sender Resend allows for your verified domain (e.g. support@hanar.net). */
const SUPPORT_FROM = 'Hanar Support <support@hanar.net>';

const allowedRoles = [
  'owner', 'ceo', 'topmanager', 'manager',
  'reviewer', 'moderator', 'support', 'editor', 'readonly', 'business',
];

const MAX_SUBJECT = 280;
const MAX_MESSAGE = 20_000;

async function verifyAdmin(req: Request): Promise<{ id: string; email: string } | null> {
  let user: { id: string; email?: string } | null = null;

  const supabaseServer = createRouteHandlerClient({ cookies });
  const { data: { user: cookieUser }, error } = await supabaseServer.auth.getUser();
  if (!error && cookieUser) user = cookieUser;

  if (!user && req && ANON_KEY) {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (token) {
      const supabaseAnon = createClient(SUPABASE_URL!, ANON_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user: tokenUser } } = await supabaseAnon.auth.getUser();
      if (tokenUser) user = tokenUser;
    }
  }

  if (!user?.id || !user?.email) return null;

  const { data: adminData } = await supabaseAdmin
    .from('adminaccounts')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  const roleData =
    adminData ??
    (await supabaseAdmin.from('adminaccounts').select('role').eq('email', user.email!.toLowerCase()).maybeSingle())
      .data;

  if (!roleData?.role || !allowedRoles.includes(roleData.role)) return null;
  return { id: user.id, email: user.email };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST: send a one-off message to a business contact (listing email, else owner auth email).
 * From address is always support@hanar.net (Resend must allow this sender).
 */
export async function POST(req: Request, context: RouteContext) {
  try {
    if (!(await verifyAdmin(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const businessId = (id || '').trim();
    if (!businessId) {
      return NextResponse.json({ error: 'Missing business id' }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as { subject?: string; message?: string } | null;
    const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
    }
    if (subject.length > MAX_SUBJECT) {
      return NextResponse.json({ error: `Subject must be at most ${MAX_SUBJECT} characters` }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE) {
      return NextResponse.json({ error: `Message must be at most ${MAX_MESSAGE} characters` }, { status: 400 });
    }

    const { data: row, error: fetchError } = await supabaseAdmin
      .from('businesses')
      .select('id, business_name, email, owner_id')
      .eq('id', businessId)
      .maybeSingle();

    if (fetchError || !row) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const toEmail = await resolveBusinessContactEmail(supabaseAdmin, {
      email: row.email,
      owner_id: row.owner_id ?? null,
    });

    if (!toEmail) {
      return NextResponse.json(
        { error: 'No email on file for this business (add a listing email or assign an owner with an account).' },
        { status: 400 }
      );
    }

    const businessName = String(row.business_name || 'Your business').trim() || 'Your business';
    const safeBodyHtml = escapeHtml(message).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '<br/>');

    const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.55; color: #111; max-width: 640px;">
  <p>Hi ${escapeHtml(businessName)},</p>
  <div style="margin: 16px 0; padding: 14px 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
    ${safeBodyHtml}
  </div>
  <p style="color:#4b5563;font-size:14px;">If you need anything else, you can reply to this email or write to <a href="mailto:support@hanar.net">support@hanar.net</a>.</p>
  <p style="color:#9ca3af;font-size:12px;margin-top:24px;">— Hanar Support</p>
</body></html>`.trim();

    const ownerId =
      typeof row.owner_id === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.owner_id)
        ? row.owner_id
        : null;

    const result = await sendHanarEmail({
      from: SUPPORT_FROM,
      to: toEmail,
      subject,
      html,
      text: `Hi ${businessName},\n\n${message}\n\n— Hanar Support\nsupport@hanar.net`,
      tags: [
        { name: 'template', value: 'admin_business_direct' },
        { name: 'business_id', value: businessId },
      ],
      logUserId: ownerId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('admin business send-email error:', err instanceof Error ? err.name : 'unknown');
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
