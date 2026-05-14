import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { resolveBusinessContactEmail } from './resolveBusinessContactEmail';
import { sendPaymentReceiptEmail } from './transactional';

/**
 * Claim a one-time receipt send for this Stripe webhook `event.id` (retries reuse the same id).
 * Returns false if this event was already claimed (skip duplicate email).
 */
export async function claimStripeReceiptEmailSlot(
  supabase: SupabaseClient,
  stripeEventId: string
): Promise<boolean> {
  const { error } = await supabase.from('stripe_checkout_receipt_emails').insert({
    stripe_event_id: stripeEventId,
  });
  if (!error) return true;
  if (error.code === '23505') return false;
  console.warn('[stripe-receipt] claim insert failed', { code: error.code });
  return false;
}

/** Undo claim so a retry can send after a failed attempt. */
export async function releaseStripeReceiptEmailSlot(
  supabase: SupabaseClient,
  stripeEventId: string
): Promise<void> {
  await supabase.from('stripe_checkout_receipt_emails').delete().eq('stripe_event_id', stripeEventId);
}

export function stripeSessionCustomerEmail(session: Stripe.Checkout.Session): string | null {
  const cd = session.customer_details;
  if (cd && typeof cd === 'object' && cd !== null && 'email' in cd) {
    const e = (cd as { email?: string | null }).email;
    if (e && String(e).trim()) return String(e).trim();
  }
  if (session.customer_email && String(session.customer_email).trim()) {
    return String(session.customer_email).trim();
  }
  return null;
}

function formatAmount(session: Stripe.Checkout.Session): { amountDisplay: string; currency: string } {
  const cents = session.amount_total ?? 0;
  const cur = (session.currency || 'usd').toUpperCase();
  const major = cents / 100;
  const amountDisplay = Number.isInteger(major) ? String(major) : major.toFixed(2);
  return { amountDisplay, currency: cur };
}

function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
}

function abs(path: string): string {
  const o = siteOrigin();
  const p = path.startsWith('/') ? path : `/${path}`;
  return o ? `${o}${p}` : p;
}

export async function resolveCheckoutRecipientEmail(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session,
  meta: Record<string, string | undefined>,
  checkoutType: string
): Promise<string | null> {
  const direct = stripeSessionCustomerEmail(session);
  if (direct) return direct;

  if (checkoutType === 'casual_pack' && meta.user_id) {
    const { data, error } = await supabase.auth.admin.getUserById(meta.user_id);
    if (!error && data?.user?.email) return String(data.user.email).trim();
    return null;
  }

  if (checkoutType === 'business_plan' && meta.business_id) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('email, owner_id')
      .eq('id', meta.business_id)
      .maybeSingle();
    if (biz) return resolveBusinessContactEmail(supabase, { email: biz.email, owner_id: biz.owner_id });
    return null;
  }

  if (checkoutType === 'promotion' && meta.business_id) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('email, owner_id')
      .eq('id', meta.business_id)
      .maybeSingle();
    if (biz) return resolveBusinessContactEmail(supabase, { email: biz.email, owner_id: biz.owner_id });
    return null;
  }

  if (checkoutType === 'org_promotion' && meta.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('email, user_id')
      .eq('id', meta.organization_id)
      .maybeSingle();
    if (!org) return null;
    const oemail = typeof org.email === 'string' && org.email.trim() ? org.email.trim() : '';
    if (oemail) return oemail;
    if (org.user_id) {
      const { data, error } = await supabase.auth.admin.getUserById(org.user_id);
      if (!error && data?.user?.email) return String(data.user.email).trim();
    }
    return null;
  }

  return null;
}

type ReceiptParts = {
  productLabel: string;
  detailLine: string | null;
  dashboardUrl: string | null;
};

export async function buildStripeCheckoutReceiptParts(
  supabase: SupabaseClient,
  checkoutType: string,
  meta: Record<string, string | undefined>
): Promise<ReceiptParts> {
  if (checkoutType === 'business_plan') {
    const bid = meta.business_id;
    const plan = meta.plan || 'plan';
    let name = '';
    if (bid) {
      const { data } = await supabase.from('businesses').select('business_name').eq('id', bid).maybeSingle();
      name = (data as { business_name?: string } | null)?.business_name?.trim() || '';
    }
    const planPretty = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Plan';
    return {
      productLabel: `${planPretty} plan`,
      detailLine: name ? `Business: ${name}` : null,
      dashboardUrl: abs('/business-dashboard'),
    };
  }
  if (checkoutType === 'casual_pack') {
    return {
      productLabel: 'Casual Seller Pack',
      detailLine: 'Marketplace listing pack (40 days)',
      dashboardUrl: abs('/dashboard'),
    };
  }
  if (checkoutType === 'promotion') {
    const bid = meta.business_id;
    let name = '';
    if (bid) {
      const { data } = await supabase.from('businesses').select('business_name').eq('id', bid).maybeSingle();
      name = (data as { business_name?: string } | null)?.business_name?.trim() || '';
    }
    const tier = meta.tier || 'promotion';
    const days = meta.duration_days || '';
    return {
      productLabel: `Feed banner (${tier}${days ? `, ${days} days` : ''})`,
      detailLine: name ? `Business: ${name}` : null,
      dashboardUrl: abs('/business-dashboard'),
    };
  }
  if (checkoutType === 'org_promotion') {
    const oid = meta.organization_id;
    let name = '';
    if (oid) {
      const { data } = await supabase.from('organizations').select('full_name').eq('id', oid).maybeSingle();
      name = (data as { full_name?: string } | null)?.full_name?.trim() || '';
    }
    const tier = meta.tier || 'promotion';
    const days = meta.duration_days || '';
    return {
      productLabel: `Organization feed banner (${tier}${days ? `, ${days} days` : ''})`,
      detailLine: name ? `Organization: ${name}` : null,
      dashboardUrl: abs('/organization/dashboard'),
    };
  }
  return { productLabel: 'Hanar purchase', detailLine: null, dashboardUrl: abs('/dashboard') };
}

/**
 * Sends one receipt per Stripe webhook event (deduped). Does not throw.
 * On send failure, releases the claim so Stripe retries can attempt again.
 */
export async function sendStripeCheckoutReceiptEmailSafe(params: {
  supabase: SupabaseClient;
  stripeEventId: string;
  session: Stripe.Checkout.Session;
  checkoutType: string;
  meta: Record<string, string | undefined>;
}): Promise<void> {
  const { supabase, stripeEventId, session, checkoutType, meta } = params;

  const claimed = await claimStripeReceiptEmailSlot(supabase, stripeEventId);
  if (!claimed) return;

  const to = await resolveCheckoutRecipientEmail(supabase, session, meta, checkoutType);
  if (!to) {
    console.info('[stripe-receipt] skipped: no recipient email');
    await releaseStripeReceiptEmailSlot(supabase, stripeEventId);
    return;
  }

  const { amountDisplay, currency } = formatAmount(session);
  const parts = await buildStripeCheckoutReceiptParts(supabase, checkoutType, meta);

  try {
    const result = await sendPaymentReceiptEmail(to, {
      productType: checkoutType,
      productLabel: parts.productLabel,
      currency,
      amountDisplay,
      detailLine: parts.detailLine,
      dashboardUrl: parts.dashboardUrl,
      tags: [{ name: 'stripe_event_id', value: stripeEventId.slice(0, 200) }],
    });
    if (!result.success) {
      console.warn('[stripe-receipt] send failed');
      await releaseStripeReceiptEmailSlot(supabase, stripeEventId);
    }
  } catch {
    console.warn('[stripe-receipt] send threw');
    await releaseStripeReceiptEmailSlot(supabase, stripeEventId);
  }
}
