import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendHanarEmail } from '@/lib/email/sendHanarEmail';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL?.trim() || 'support@hanar.net';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** POST: contact form submission (including business claim requests without listing email). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      name?: string;
      email?: string;
      phone?: string;
      subject?: string;
      message?: string;
      businessId?: string;
      businessName?: string;
      businessSlug?: string;
      source?: string;
    } | null;

    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const phone = String(body?.phone || '').trim() || null;
    const subject = String(body?.subject || '').trim();
    const message = String(body?.message || '').trim();
    const businessId = String(body?.businessId || '').trim() || null;
    const businessName = String(body?.businessName || '').trim() || null;
    const businessSlug = String(body?.businessSlug || '').trim() || null;
    const source = String(body?.source || 'contact').trim() || 'contact';

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: 'Name, email, subject, and message are required.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }
    if (message.length < 20) {
      return NextResponse.json({ error: 'Message must be at least 20 characters.' }, { status: 400 });
    }
    if (source === 'business_claim') {
      if (!phone) {
        return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 });
      }
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        return NextResponse.json({ error: 'Enter a valid phone number (at least 10 digits).' }, { status: 400 });
      }
    }

    const { error: insertErr } = await supabaseAdmin.from('contact_submissions').insert({
      name,
      email,
      phone,
      subject,
      message,
      business_id: businessId,
      business_name: businessName,
      business_slug: businessSlug,
      source,
      status: 'pending',
    });

    if (insertErr) {
      console.error('contact_submissions insert:', insertErr);
      return NextResponse.json({ error: 'Failed to save your message.' }, { status: 500 });
    }

    const businessLine = businessName
      ? `<p><strong>Business:</strong> ${businessName}${businessSlug ? ` (/business/${businessSlug})` : ''}</p>`
      : '';
    const phoneLine = phone ? `<p><strong>Phone:</strong> ${phone}</p>` : '';

    await sendHanarEmail({
      to: SUPPORT_EMAIL,
      subject: `[Hanar Contact] ${subject}`,
      html: `
        <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
        ${phoneLine}
        ${businessLine}
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Source:</strong> ${source}</p>
        <hr />
        <p>${message.replace(/\n/g, '<br />')}</p>
      `,
      text: `From: ${name} <${email}>\nPhone: ${phone || '—'}\nBusiness: ${businessName || '—'}\n\n${message}`,
      tags: [{ name: 'template', value: 'contact_submission' }],
    });

    return NextResponse.json({ success: true, message: 'Message sent. We will get back to you shortly.' });
  } catch (err) {
    console.error('contact API error:', err);
    return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 });
  }
}
