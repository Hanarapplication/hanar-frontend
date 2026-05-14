/**
 * Promotion payment succeeded; request is in review (pending_review).
 */

export type BannerPaymentReceivedTemplateProps = {
  campaignTitle: string;
  entityDisplayName: string | null;
  /** Optional formatted amount e.g. "$49.00". */
  amountLabel?: string | null;
  dashboardPath?: string | null;
  origin?: string | null;
};

function absoluteHref(origin: string | null | undefined, path: string): string {
  const base = (origin ?? '').trim().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export function buildBannerPaymentReceivedEmail(props: BannerPaymentReceivedTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(props.campaignTitle.trim() || 'Your promotion');
  const who = escapeHtml((props.entityDisplayName ?? '').trim() || 'your account');
  const amt = (props.amountLabel ?? '').trim();
  const amtHtml = amt ? `<p><strong>Payment:</strong> ${escapeHtml(amt)}</p>` : '';
  const subject = 'Payment received — your Hanar banner is in review';
  const dash = absoluteHref(props.origin, props.dashboardPath?.trim() || '/');

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p>We received payment for <strong>${title}</strong> (${who}). Your banner is now <strong>in review</strong>.</p>
  ${amtHtml}
  <p><a href="${dash}">Open your dashboard</a></p>
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const text = `Payment received for "${props.campaignTitle.trim() || 'Your promotion'}" (${(props.entityDisplayName ?? '').trim() || 'your account'}). Your banner is in review.${amt ? ` ${amt}` : ''}\n${dash}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
