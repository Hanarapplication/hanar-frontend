import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveBusinessContactEmail } from './resolveBusinessContactEmail';
import {
  sendBannerApprovedEmail,
  sendBannerOnHoldEmail,
  sendBannerPaymentReceivedEmail,
  sendBannerRejectedEmail,
  sendBannerSubmittedEmail,
} from './transactional';

export type BannerPromotionRecipientContext = {
  email: string | null;
  entityDisplayName: string | null;
};

/**
 * Business promotion emails: `businesses.email` first, then owner Auth email.
 */
export async function resolveBusinessBannerPromotionRecipient(
  supabaseAdmin: SupabaseClient,
  businessId: string | null | undefined
): Promise<BannerPromotionRecipientContext> {
  const id = (businessId ?? '').trim();
  if (!id) return { email: null, entityDisplayName: null };
  try {
    const { data, error } = await supabaseAdmin
      .from('businesses')
      .select('business_name, email, owner_id')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return { email: null, entityDisplayName: null };
    const name = typeof data.business_name === 'string' && data.business_name.trim() ? data.business_name.trim() : null;
    const email = await resolveBusinessContactEmail(supabaseAdmin, {
      email: data.email,
      owner_id: data.owner_id ?? null,
    });
    return { email, entityDisplayName: name };
  } catch {
    return { email: null, entityDisplayName: null };
  }
}

/**
 * Organization promotion emails: `organizations.email` first, then org owner Auth email.
 */
export async function resolveOrganizationBannerPromotionRecipient(
  supabaseAdmin: SupabaseClient,
  organizationId: string | null | undefined
): Promise<BannerPromotionRecipientContext> {
  const id = (organizationId ?? '').trim();
  if (!id) return { email: null, entityDisplayName: null };
  try {
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('full_name, email, user_id')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return { email: null, entityDisplayName: null };
    const name = typeof data.full_name === 'string' && data.full_name.trim() ? data.full_name.trim() : null;
    const direct = typeof data.email === 'string' && data.email.trim() ? data.email.trim() : '';
    if (direct) return { email: direct, entityDisplayName: name };
    const uid = typeof data.user_id === 'string' && data.user_id.trim() ? data.user_id.trim() : '';
    if (!uid) return { email: null, entityDisplayName: name };
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.getUserById(uid);
    if (authErr || !authData?.user?.email) return { email: null, entityDisplayName: name };
    const email = String(authData.user.email).trim();
    return { email: email || null, entityDisplayName: name };
  } catch {
    return { email: null, entityDisplayName: null };
  }
}

function defaultOrigin(): string | undefined {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return u && u.length > 0 ? u.replace(/\/$/, '') : undefined;
}

function dashboardPathForSource(source: 'business' | 'organization'): string {
  return source === 'organization' ? '/organization/dashboard' : '/business-dashboard';
}

function campaignTitleFromRequestRow(row: {
  description?: string | null;
  placement?: string | null;
  tier?: string | null;
}): string {
  const d = (row.description ?? '').trim();
  if (d) return d;
  const p = (row.placement ?? '').trim();
  const t = (row.tier ?? '').trim();
  if (p && t) return `${p} · ${t}`;
  if (p) return p;
  return 'Your feed banner';
}

function formatCents(cents: number | null | undefined): string | null {
  if (cents == null || !Number.isFinite(cents) || cents < 0) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

/**
 * After creating a promotion request (pending_payment).
 */
export async function notifyBannerPromotionSubmittedWithRow(
  supabaseAdmin: SupabaseClient,
  args: {
    source: 'business' | 'organization';
    businessId?: string | null;
    organizationId?: string | null;
    requestId: string;
    row: { description?: string | null; placement?: string | null; tier?: string | null };
  }
): Promise<void> {
  const title = campaignTitleFromRequestRow(args.row);
  const ctx =
    args.source === 'organization'
      ? await resolveOrganizationBannerPromotionRecipient(supabaseAdmin, args.organizationId)
      : await resolveBusinessBannerPromotionRecipient(supabaseAdmin, args.businessId);
  if (!ctx.email) {
    console.info('[banner-promotion-email] submitted: skipped (no recipient)');
    return;
  }
  const origin = defaultOrigin();
  const dash = dashboardPathForSource(args.source);
  try {
    const result = await sendBannerSubmittedEmail(ctx.email, {
      campaignTitle: title,
      entityDisplayName: ctx.entityDisplayName,
      dashboardPath: dash,
      origin,
      tags: [
        { name: 'promotion_request_id', value: args.requestId },
        { name: 'promotion_source', value: args.source },
      ],
    });
    if (!result.success) console.warn('[banner-promotion-email] submitted: send failed', { hasError: true });
  } catch {
    console.warn('[banner-promotion-email] submitted: send threw');
  }
}

/**
 * After Stripe moves request to pending_review (payment received). Caller must only invoke when DB update matched rows.
 */
export async function notifyBannerPromotionPaymentReceived(
  supabaseAdmin: SupabaseClient,
  args: {
    source: 'business' | 'organization';
    requestId: string;
    sessionAmountCents?: number | null;
  }
): Promise<void> {
  const table = args.source === 'business' ? 'business_promotion_requests' : 'organization_promotion_requests';
  const { data: row, error } = await supabaseAdmin
    .from(table)
    .select('id, description, placement, tier, price_cents, business_id, organization_id')
    .eq('id', args.requestId)
    .maybeSingle();
  if (error || !row) {
    console.info('[banner-promotion-email] payment_received: skipped (row missing)');
    return;
  }
  const businessId = (row as { business_id?: string }).business_id;
  const organizationId = (row as { organization_id?: string }).organization_id;
  const ctx =
    args.source === 'organization'
      ? await resolveOrganizationBannerPromotionRecipient(supabaseAdmin, organizationId)
      : await resolveBusinessBannerPromotionRecipient(supabaseAdmin, businessId);
  if (!ctx.email) {
    console.info('[banner-promotion-email] payment_received: skipped (no recipient)');
    return;
  }
  const title = campaignTitleFromRequestRow(row);
  const amountLabel = formatCents(args.sessionAmountCents ?? (row as { price_cents?: number }).price_cents);
  const origin = defaultOrigin();
  const dash = dashboardPathForSource(args.source);
  try {
    const result = await sendBannerPaymentReceivedEmail(ctx.email, {
      campaignTitle: title,
      entityDisplayName: ctx.entityDisplayName,
      amountLabel,
      dashboardPath: dash,
      origin,
      tags: [
        { name: 'promotion_request_id', value: args.requestId },
        { name: 'promotion_source', value: args.source },
      ],
    });
    if (!result.success) console.warn('[banner-promotion-email] payment_received: send failed', { hasError: true });
  } catch {
    console.warn('[banner-promotion-email] payment_received: send threw');
  }
}

/**
 * Admin approved a promotion request (pending_review → approved).
 */
export async function notifyBannerPromotionApproved(
  supabaseAdmin: SupabaseClient,
  args: {
    source: 'business' | 'organization';
    requestId: string;
  }
): Promise<void> {
  const table = args.source === 'business' ? 'business_promotion_requests' : 'organization_promotion_requests';
  const { data: row, error } = await supabaseAdmin
    .from(table)
    .select('id, description, placement, tier, business_id, organization_id')
    .eq('id', args.requestId)
    .maybeSingle();
  if (error || !row) return;
  const businessId = (row as { business_id?: string }).business_id;
  const organizationId = (row as { organization_id?: string }).organization_id;
  const ctx =
    args.source === 'organization'
      ? await resolveOrganizationBannerPromotionRecipient(supabaseAdmin, organizationId)
      : await resolveBusinessBannerPromotionRecipient(supabaseAdmin, businessId);
  if (!ctx.email) {
    console.info('[banner-promotion-email] approved: skipped (no recipient)');
    return;
  }
  const title = campaignTitleFromRequestRow(row);
  const origin = defaultOrigin();
  const dash = dashboardPathForSource(args.source);
  try {
    const result = await sendBannerApprovedEmail(ctx.email, {
      campaignTitle: title,
      entityDisplayName: ctx.entityDisplayName,
      dashboardPath: dash,
      origin,
      tags: [
        { name: 'promotion_request_id', value: args.requestId },
        { name: 'promotion_source', value: args.source },
      ],
    });
    if (!result.success) console.warn('[banner-promotion-email] approved: send failed', { hasError: true });
  } catch {
    console.warn('[banner-promotion-email] approved: send threw');
  }
}

/**
 * Admin rejected a promotion request.
 */
export async function notifyBannerPromotionRejected(
  supabaseAdmin: SupabaseClient,
  args: {
    source: 'business' | 'organization';
    requestId: string;
  }
): Promise<void> {
  const table = args.source === 'business' ? 'business_promotion_requests' : 'organization_promotion_requests';
  const { data: row, error } = await supabaseAdmin
    .from(table)
    .select('id, description, placement, tier, business_id, organization_id')
    .eq('id', args.requestId)
    .maybeSingle();
  if (error || !row) return;
  const businessId = (row as { business_id?: string }).business_id;
  const organizationId = (row as { organization_id?: string }).organization_id;
  const ctx =
    args.source === 'organization'
      ? await resolveOrganizationBannerPromotionRecipient(supabaseAdmin, organizationId)
      : await resolveBusinessBannerPromotionRecipient(supabaseAdmin, businessId);
  if (!ctx.email) {
    console.info('[banner-promotion-email] rejected: skipped (no recipient)');
    return;
  }
  const title = campaignTitleFromRequestRow(row);
  const origin = defaultOrigin();
  const dash = dashboardPathForSource(args.source);
  try {
    const result = await sendBannerRejectedEmail(ctx.email, {
      campaignTitle: title,
      entityDisplayName: ctx.entityDisplayName,
      dashboardPath: dash,
      origin: origin ?? null,
      tags: [
        { name: 'promotion_request_id', value: args.requestId },
        { name: 'promotion_source', value: args.source },
      ],
    });
    if (!result.success) console.warn('[banner-promotion-email] rejected: send failed', { hasError: true });
  } catch {
    console.warn('[banner-promotion-email] rejected: send threw');
  }
}

/**
 * Linked promotion request found for a feed banner; notify when banner status becomes on_hold from active.
 */
export async function notifyLinkedBannerOnHold(
  supabaseAdmin: SupabaseClient,
  args: {
    feedBannerId: string;
  }
): Promise<void> {
  const { data: bizReq } = await supabaseAdmin
    .from('business_promotion_requests')
    .select('id, description, placement, tier, business_id')
    .eq('feed_banner_id', args.feedBannerId)
    .maybeSingle();
  if (bizReq?.business_id) {
    const ctx = await resolveBusinessBannerPromotionRecipient(supabaseAdmin, bizReq.business_id);
    if (!ctx.email) return;
    const title = campaignTitleFromRequestRow(bizReq);
    const origin = defaultOrigin();
    try {
      await sendBannerOnHoldEmail(ctx.email, {
        campaignTitle: title,
        entityDisplayName: ctx.entityDisplayName,
        dashboardPath: '/business-dashboard',
        origin: origin ?? null,
        tags: [
          { name: 'feed_banner_id', value: args.feedBannerId },
          { name: 'promotion_request_id', value: String(bizReq.id) },
          { name: 'promotion_source', value: 'business' },
        ],
      });
    } catch {
      console.warn('[banner-promotion-email] on_hold: send threw');
    }
    return;
  }

  const { data: orgReq } = await supabaseAdmin
    .from('organization_promotion_requests')
    .select('id, description, placement, tier, organization_id')
    .eq('feed_banner_id', args.feedBannerId)
    .maybeSingle();
  if (orgReq?.organization_id) {
    const ctx = await resolveOrganizationBannerPromotionRecipient(supabaseAdmin, orgReq.organization_id);
    if (!ctx.email) return;
    const title = campaignTitleFromRequestRow(orgReq);
    const origin = defaultOrigin();
    try {
      await sendBannerOnHoldEmail(ctx.email, {
        campaignTitle: title,
        entityDisplayName: ctx.entityDisplayName,
        dashboardPath: '/organization/dashboard',
        origin: origin ?? null,
        tags: [
          { name: 'feed_banner_id', value: args.feedBannerId },
          { name: 'promotion_request_id', value: String(orgReq.id) },
          { name: 'promotion_source', value: 'organization' },
        ],
      });
    } catch {
      console.warn('[banner-promotion-email] on_hold: send threw');
    }
  }
}
