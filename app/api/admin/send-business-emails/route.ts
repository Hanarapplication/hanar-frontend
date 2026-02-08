import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
  'reviewer', 'moderator', 'support',
  'editor', 'readonly',
];

type Audience =
  | 'all_users'
  | 'individuals'
  | 'organizations'
  | 'businesses'
  | 'business_free'
  | 'business_starter'
  | 'business_growth'
  | 'business_premium'
  | 'business_free_trial';

async function verifyAdmin(): Promise<string | null> {
  const supabaseServer = createRouteHandlerClient({ cookies });
  const { data: { user }, error } = await supabaseServer.auth.getUser();
  if (error || !user?.email) return null;

  const { data } = await supabaseAdmin
    .from('adminaccounts')
    .select('role')
    .eq('email', user.email.toLowerCase())
    .maybeSingle();

  if (!data?.role || !allowedRoles.includes(data.role)) return null;
  return user.email;
}

export async function POST(req: Request) {
  try {
    const adminEmail = await verifyAdmin();
    if (!adminEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { audience, subject, body: emailBody } = body as {
      audience?: Audience;
      subject?: string;
      body?: string;
    };

    const safeSubject = String(subject || '').trim();
    const safeBody = String(emailBody || '').trim();

    if (!safeSubject || !safeBody) {
      return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 });
    }

    const validAudiences: Audience[] = [
      'all_users', 'individuals', 'organizations', 'businesses',
      'business_free', 'business_starter', 'business_growth', 'business_premium', 'business_free_trial',
    ];
    if (!audience || !validAudiences.includes(audience)) {
      return NextResponse.json({ error: 'Invalid audience' }, { status: 400 });
    }

    const emailsToSend: string[] = [];
    const seen = new Set<string>();

    async function addEmail(email: string) {
      const e = (email || '').trim().toLowerCase();
      if (e && !seen.has(e)) {
        seen.add(e);
        emailsToSend.push(e);
      }
    }

    async function resolveAuthEmails(userIds: string[]) {
      const unique = [...new Set(userIds.filter(Boolean))];
      for (const id of unique) {
        const { data } = await supabaseAdmin.auth.admin.getUserById(id);
        if (data?.user?.email) await addEmail(data.user.email);
      }
    }

    // Individuals: registeredaccounts where business=false, organization=false
    if (audience === 'all_users' || audience === 'individuals') {
      const { data: ra } = await supabaseAdmin
        .from('registeredaccounts')
        .select('user_id, email')
        .eq('business', false)
        .eq('organization', false);
      for (const r of ra || []) {
        if (r.email) await addEmail(r.email);
        else if (r.user_id) await resolveAuthEmails([r.user_id]);
      }
    }

    // Organizations
    if (audience === 'all_users' || audience === 'organizations') {
      const { data: orgs } = await supabaseAdmin
        .from('organizations')
        .select('user_id, email');
      for (const o of orgs || []) {
        if (o.email) await addEmail(o.email);
        else if (o.user_id) await resolveAuthEmails([o.user_id]);
      }
    }

    // Businesses (all or by plan)
    const isBusinessAudience =
      audience === 'all_users' ||
      audience === 'businesses' ||
      audience.startsWith('business_');
    if (isBusinessAudience) {
      let q = supabaseAdmin.from('businesses').select('id, owner_id, email');
      if (audience === 'business_free_trial') {
        q = q.eq('plan', 'premium').not('trial_end', 'is', null);
      } else if (audience.startsWith('business_') && audience !== 'businesses') {
        const plan = audience.replace('business_', '');
        q = q.eq('plan', plan);
      }
      const { data: businesses } = await q;
      for (const b of businesses || []) {
        if (b.email) await addEmail(b.email);
        else if (b.owner_id) await resolveAuthEmails([b.owner_id]);
      }
    }

    if (emailsToSend.length === 0) {
      return NextResponse.json({
        sent: 0,
        failed: 0,
        total: 0,
        message: 'No recipients match the selected audience',
      }, { status: 200 });
    }

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="white-space: pre-wrap;">${escapeHtml(safeBody)}</div>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
        <p style="color: #666; font-size: 12px;">Sent by Hanar Admin</p>
      </div>
    `;

    let sent = 0;
    let failed = 0;
    for (const email of emailsToSend) {
      const { error: sendErr } = await resend.emails.send({
        from: EMAIL_FROM,
        to: email,
        subject: safeSubject,
        html,
      });
      if (sendErr) {
        console.error(`Failed to send to ${email}:`, sendErr);
        failed++;
      } else {
        sent++;
      }
    }

    return NextResponse.json({
      sent,
      failed,
      total: emailsToSend.length,
      message: `Sent ${sent} of ${emailsToSend.length} emails${failed > 0 ? ` (${failed} failed)` : ''}`,
    });
  } catch (err: unknown) {
    console.error('send-business-emails error:', err);
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
