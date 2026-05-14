/**
 * Promotion payment succeeded; request is in review (pending_review).
 */

export type BannerPaymentReceivedTemplateProps = {
  campaignTitle: string;
  entityDisplayName: string | null;
  /** Optional formatted amount e.g. "$49.00". */
  amountLabel?: string | null;
  /** @deprecated No longer used in email copy; kept for call-site compatibility. */
  dashboardPath?: string | null;
  origin?: string | null;
};

const APP_WEB_CTA_HTML =
  '<p>Open the <strong>Hanar</strong> mobile app or our website while signed in to watch review progress and any messages about your banner.</p>';

const APP_WEB_CTA_TEXT =
  'Open the Hanar mobile app or our website while signed in to watch review progress and any messages about your banner.';

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

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p>We received payment for <strong>${title}</strong> (${who}). Your banner is now <strong>in review</strong>.</p>
  ${amtHtml}
  ${APP_WEB_CTA_HTML}
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const plainTitle = props.campaignTitle.trim() || 'Your promotion';
  const plainWho = (props.entityDisplayName ?? '').trim() || 'your account';
  const text = `Payment received for "${plainTitle}" (${plainWho}). Your banner is in review.${amt ? ` ${amt}` : ''}\n\n${APP_WEB_CTA_TEXT}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
