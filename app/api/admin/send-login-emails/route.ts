import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Hanar <onboarding@resend.dev>';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');
if (!RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const resend = new Resend(RESEND_API_KEY);

const allowedRoles = [
  'owner', 'ceo', 'topmanager', 'manager',
  'reviewer', 'moderator', 'support', 'editor', 'readonly',
];

type Audience =
  | 'all_businesses'
  | 'all_organizations'
  | 'business_admin_added'
  | 'organization_admin_added'
  | 'individual_business'
  | 'individual_organization';

function generateOTP(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function verifyAdmin(req: Request): Promise<string | null> {
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

  if (!user?.email) return null;

  const { data } = await supabaseAdmin
    .from('adminaccounts')
    .select('role')
    .eq('email', user.email.toLowerCase())
    .maybeSingle();

  if (!data?.role || !allowedRoles.includes(data.role)) return null;
  return user.email;
}

interface Recipient {
  email: string;
  userId: string;
  name: string;
}

export async function POST(req: Request) {
  try {
    const adminEmail = await verifyAdmin(req);
    if (!adminEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

    const { audience, businessId, organizationId, subject, customMessage } = body as {
      audience?: Audience;
      businessId?: string;
      organizationId?: string;
      subject?: string;
      customMessage?: string;
    };

    const validAudiences: Audience[] = [
      'all_businesses', 'all_organizations',
      'business_admin_added', 'organization_admin_added',
      'individual_business', 'individual_organization',
    ];
    if (!audience || !validAudiences.includes(audience)) {
      return NextResponse.json({ error: 'Invalid audience' }, { status: 400 });
    }

    const recipients: Recipient[] = [];
    const seen = new Set<string>();

    async function resolveEmail(userId: string): Promise<string | null> {
      const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
      return data?.user?.email?.toLowerCase() || null;
    }

    if (audience === 'individual_business' && businessId) {
      const { data } = await supabaseAdmin
        .from('businesses')
        .select('id, business_name, email, owner_id')
        .eq('id', businessId)
        .maybeSingle();
      if (!data) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
      const email = (data.email || await resolveEmail(data.owner_id))?.trim().toLowerCase();
      if (!email) return NextResponse.json({ error: 'Business has no email' }, { status: 400 });
      recipients.push({ email, userId: data.owner_id, name: data.business_name || 'Business' });
    } else if (audience === 'individual_organization' && organizationId) {
      const { data } = await supabaseAdmin
        .from('organizations')
        .select('id, full_name, email, user_id')
        .eq('id', organizationId)
        .maybeSingle();
      if (!data) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      const email = (data.email || await resolveEmail(data.user_id))?.trim().toLowerCase();
      if (!email) return NextResponse.json({ error: 'Organization has no email' }, { status: 400 });
      recipients.push({ email, userId: data.user_id, name: data.full_name || 'Organization' });
    } else if (audience === 'all_businesses' || audience === 'business_admin_added') {
      let q = supabaseAdmin.from('businesses').select('id, business_name, email, owner_id');
      if (audience === 'business_admin_added') {
        q = q.not('admin_added_at', 'is', null);
      }
      const { data } = await q;
      for (const b of data || []) {
        const email = (b.email || await resolveEmail(b.owner_id))?.trim().toLowerCase();
        if (!email || seen.has(email)) continue;
        seen.add(email);
        recipients.push({ email, userId: b.owner_id, name: b.business_name || 'Business' });
      }
    } else if (audience === 'all_organizations' || audience === 'organization_admin_added') {
      let q = supabaseAdmin.from('organizations').select('id, full_name, email, user_id');
      if (audience === 'organization_admin_added') {
        q = q.not('admin_added_at', 'is', null);
      }
      const { data } = await q;
      for (const o of data || []) {
        const email = (o.email || await resolveEmail(o.user_id))?.trim().toLowerCase();
        if (!email || seen.has(email)) continue;
        seen.add(email);
        recipients.push({ email, userId: o.user_id, name: o.full_name || 'Organization' });
      }
    }

    if (recipients.length === 0) {
      return NextResponse.json({
        sent: 0,
        failed: 0,
        total: 0,
        message: 'No recipients match the selected audience',
      }, { status: 200 });
    }

    const defaultSubject = 'Your Hanar Login Credentials';
    const safeSubject = String(subject || defaultSubject).trim();
    const defaultIntro = `Your business has been added to Hanar, a cultural community and local business discovery platform.
Your listing is currently active at no cost.

By claiming your profile, you can update your information, add photos, business hours, services, and connect directly with customers in your area.`;
    const customIntro = String(customMessage || '').trim();

    let sent = 0;
    let failed = 0;
    const failedDetails: { email: string; reason: string }[] = [];

    for (const r of recipients) {
      const otp = generateOTP(10);
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(r.userId, { password: otp });
      if (updateErr) {
        console.error(`[send-login-emails] Password update failed for ${r.email}:`, updateErr.message);
        failed++;
        failedDetails.push({ email: r.email, reason: `Password update failed: ${updateErr.message}` });
        continue;
      }

      const introHtml = customIntro
        ? `<p>${customIntro.split('\n').map((line) => escapeHtml(line)).join('<br />')}</p>`
        : `<p>${defaultIntro.split('\n').map((line) => escapeHtml(line)).join('<br />')}</p>`;
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You're on Hanar</h2>
          <p>Hello${r.name ? ` ${r.name}` : ''},</p>
          ${introHtml}
          <p>Your login credentials are below. Use them to sign in at the login page:</p>
          <p><strong>Login (email):</strong> ${escapeHtml(r.email)}</p>
          <p><strong>One-time password:</strong> <code style="background:#f0f0f0;padding:4px 8px;font-size:16px;">${escapeHtml(otp)}</code></p>
          <p>Please change your password after your first login for security.</p>
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
          <p style="color: #666; font-size: 12px;">Sent by Hanar Admin</p>
        </div>
      `;

      const { error: sendErr } = await resend.emails.send({
        from: EMAIL_FROM,
        to: r.email,
        subject: safeSubject,
        html,
      });

      if (sendErr) {
        console.error(`[send-login-emails] Resend failed for ${r.email}:`, sendErr.message);
        failed++;
        failedDetails.push({ email: r.email, reason: `Email send failed: ${sendErr.message}` });
      } else {
        sent++;
      }
    }

    return NextResponse.json({
      sent,
      failed,
      total: recipients.length,
      message: `Sent ${sent} of ${recipients.length} login emails${failed > 0 ? ` (${failed} failed)` : ''}`,
      ...(failedDetails.length > 0 && { failedDetails }),
    });
  } catch (err: unknown) {
    console.error('send-login-emails error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
