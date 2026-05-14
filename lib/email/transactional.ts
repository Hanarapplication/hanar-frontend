import { sendHanarEmail, type HanarEmailTag, type SendHanarEmailResult } from './sendHanarEmail';
import { buildBusinessApprovedEmail } from './templates/businessApproved';
import { buildBusinessRejectedEmail } from './templates/businessRejected';
import { buildBusinessOnHoldEmail } from './templates/businessOnHold';
import { buildMarketplaceApprovedEmail } from './templates/marketplaceApproved';
import { buildMarketplaceOnHoldEmail } from './templates/marketplaceOnHold';
import { buildMarketplaceRejectedEmail } from './templates/marketplaceRejected';
import { buildMarketplaceSubmittedEmail } from './templates/marketplaceSubmitted';
import { buildPaymentReceiptEmail } from './templates/paymentReceipt';
import { buildBannerApprovedEmail } from './templates/bannerApproved';
import { buildBannerOnHoldEmail } from './templates/bannerOnHold';
import { buildBannerPaymentReceivedEmail } from './templates/bannerPaymentReceived';
import { buildBannerRejectedEmail } from './templates/bannerRejected';
import { buildBannerSubmittedEmail } from './templates/bannerSubmitted';

/**
 * Typed “send now” helpers: each loads a template from `./templates/`, merges optional Resend `tags`,
 * and delegates to {@link sendHanarEmail}. Add new flows by creating `templates/foo.ts` + `sendFooEmail` here.
 */

/** Optional site origin for absolute links in templates (e.g. https://www.hanar.net). */
function defaultOrigin(): string | undefined {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return u && u.length > 0 ? u.replace(/\/$/, '') : undefined;
}

function tag(name: string, value: string): HanarEmailTag[] {
  return [{ name, value: String(value).slice(0, 200) }];
}

// ——— Business ———

export async function sendBusinessApprovedEmail(
  to: string,
  props: Parameters<typeof buildBusinessApprovedEmail>[0] & { tags?: HanarEmailTag[] }
): Promise<SendHanarEmailResult> {
  const { tags: extraTags, ...rest } = props;
  const body = buildBusinessApprovedEmail({ ...rest, origin: rest.origin ?? defaultOrigin() });
  return sendHanarEmail({
    to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    tags: [...tag('template', 'business_approved'), ...(extraTags ?? [])],
  });
}

export async function sendBusinessRejectedEmail(
  to: string,
  props: Parameters<typeof buildBusinessRejectedEmail>[0] & { tags?: HanarEmailTag[] }
): Promise<SendHanarEmailResult> {
  const { tags: extraTags, ...rest } = props;
  const body = buildBusinessRejectedEmail({
    ...rest,
    origin: rest.origin ?? defaultOrigin() ?? null,
  });
  return sendHanarEmail({
    to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    tags: [...tag('template', 'business_rejected'), ...(extraTags ?? [])],
  });
}

export async function sendBusinessOnHoldEmail(
  to: string,
  props: Parameters<typeof buildBusinessOnHoldEmail>[0] & { tags?: HanarEmailTag[] }
): Promise<SendHanarEmailResult> {
  const { tags: extraTags, ...rest } = props;
  const body = buildBusinessOnHoldEmail({
    ...rest,
    origin: rest.origin ?? defaultOrigin() ?? null,
  });
  return sendHanarEmail({
    to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    tags: [...tag('template', 'business_on_hold'), ...(extraTags ?? [])],
  });
}

// ——— Marketplace ———

export async function sendMarketplaceApprovedEmail(
  to: string,
  props: Parameters<typeof buildMarketplaceApprovedEmail>[0] & { tags?: HanarEmailTag[] }
): Promise<SendHanarEmailResult> {
  const { tags: extraTags, ...rest } = props;
  const origin = rest.origin ?? defaultOrigin();
  const body = buildMarketplaceApprovedEmail({ ...rest, origin });
  return sendHanarEmail({
    to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    tags: [...tag('template', 'marketplace_approved'), ...(extraTags ?? [])],
  });
}

export async function sendMarketplaceSubmittedEmail(
  to: string,
  props: Parameters<typeof buildMarketplaceSubmittedEmail>[0] & { tags?: HanarEmailTag[] }
): Promise<SendHanarEmailResult> {
  const { tags: extraTags, ...rest } = props;
  const origin = rest.origin ?? defaultOrigin();
  const body = buildMarketplaceSubmittedEmail({ ...rest, origin });
  return sendHanarEmail({
    to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    tags: [...tag('template', 'marketplace_submitted'), ...(extraTags ?? [])],
  });
}

export async function sendMarketplaceRejectedEmail(
  to: string,
  props: Parameters<typeof buildMarketplaceRejectedEmail>[0] & { tags?: HanarEmailTag[] }
): Promise<SendHanarEmailResult> {
  const { tags: extraTags, ...rest } = props;
  const body = buildMarketplaceRejectedEmail({
    ...rest,
    origin: rest.origin ?? defaultOrigin() ?? null,
  });
  return sendHanarEmail({
    to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    tags: [...tag('template', 'marketplace_rejected'), ...(extraTags ?? [])],
  });
}

export async function sendMarketplaceOnHoldEmail(
  to: string,
  props: Parameters<typeof buildMarketplaceOnHoldEmail>[0] & { tags?: HanarEmailTag[] }
): Promise<SendHanarEmailResult> {
  const { tags: extraTags, ...rest } = props;
  const body = buildMarketplaceOnHoldEmail({
    ...rest,
    origin: rest.origin ?? defaultOrigin() ?? null,
  });
  return sendHanarEmail({
    to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    tags: [...tag('template', 'marketplace_on_hold'), ...(extraTags ?? [])],
  });
}

// ——— Banners / promotion requests ———

export async function sendBannerSubmittedEmail(
  to: string,
  props: Parameters<typeof buildBannerSubmittedEmail>[0] & { tags?: HanarEmailTag[] }
): Promise<SendHanarEmailResult> {
  const { tags: extraTags, ...rest } = props;
  const body = buildBannerSubmittedEmail({
    ...rest,
    origin: rest.origin ?? defaultOrigin() ?? null,
  });
  return sendHanarEmail({
    to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    tags: [...tag('template', 'banner_submitted'), ...(extraTags ?? [])],
  });
}

export async function sendBannerPaymentReceivedEmail(
  to: string,
  props: Parameters<typeof buildBannerPaymentReceivedEmail>[0] & { tags?: HanarEmailTag[] }
): Promise<SendHanarEmailResult> {
  const { tags: extraTags, ...rest } = props;
  const body = buildBannerPaymentReceivedEmail({
    ...rest,
    origin: rest.origin ?? defaultOrigin() ?? null,
  });
  return sendHanarEmail({
    to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    tags: [...tag('template', 'banner_payment_received'), ...(extraTags ?? [])],
  });
}

export async function sendBannerApprovedEmail(
  to: string,
  props: Parameters<typeof buildBannerApprovedEmail>[0] & { tags?: HanarEmailTag[] }
): Promise<SendHanarEmailResult> {
  const { tags: extraTags, ...rest } = props;
  const body = buildBannerApprovedEmail({
    ...rest,
    origin: rest.origin ?? defaultOrigin() ?? null,
  });
  return sendHanarEmail({
    to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    tags: [...tag('template', 'banner_approved'), ...(extraTags ?? [])],
  });
}

export async function sendBannerRejectedEmail(
  to: string,
  props: Parameters<typeof buildBannerRejectedEmail>[0] & { tags?: HanarEmailTag[] }
): Promise<SendHanarEmailResult> {
  const { tags: extraTags, ...rest } = props;
  const body = buildBannerRejectedEmail({
    ...rest,
    origin: rest.origin ?? defaultOrigin() ?? null,
  });
  return sendHanarEmail({
    to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    tags: [...tag('template', 'banner_rejected'), ...(extraTags ?? [])],
  });
}

export async function sendBannerOnHoldEmail(
  to: string,
  props: Parameters<typeof buildBannerOnHoldEmail>[0] & { tags?: HanarEmailTag[] }
): Promise<SendHanarEmailResult> {
  const { tags: extraTags, ...rest } = props;
  const body = buildBannerOnHoldEmail({
    ...rest,
    origin: rest.origin ?? defaultOrigin() ?? null,
  });
  return sendHanarEmail({
    to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    tags: [...tag('template', 'banner_on_hold'), ...(extraTags ?? [])],
  });
}

// ——— Payments ———

export async function sendPaymentReceiptEmail(
  to: string,
  props: Parameters<typeof buildPaymentReceiptEmail>[0] & { tags?: HanarEmailTag[] }
): Promise<SendHanarEmailResult> {
  const { tags: extraTags, ...rest } = props;
  const body = buildPaymentReceiptEmail(rest);
  return sendHanarEmail({
    to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    tags: [...tag('template', 'payment_receipt'), ...(extraTags ?? [])],
  });
}
