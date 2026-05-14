/**
 * Business or organization submitted a feed banner / promotion request (before or awaiting payment).
 */

export type BannerSubmittedTemplateProps = {
  campaignTitle: string;
  entityDisplayName: string | null;
  /** @deprecated No longer used in email copy; kept for call-site compatibility. */
  dashboardPath?: string | null;
  origin?: string | null;
};

const APP_WEB_CTA_HTML =
  '<p>Open the <strong>Hanar</strong> mobile app or our website while signed in to finish payment (if needed), upload assets, and follow review status.</p>';

const APP_WEB_CTA_TEXT =
  'Open the Hanar mobile app or our website while signed in to finish payment if needed, upload assets, and follow review status.';

export function buildBannerSubmittedEmail(props: BannerSubmittedTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(props.campaignTitle.trim() || 'Your promotion');
  const who = escapeHtml((props.entityDisplayName ?? '').trim() || 'your account');
  const subject = 'We received your Hanar banner promotion request';

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p>Thanks for submitting <strong>${title}</strong> for <strong>${who}</strong>.</p>
  <p>Complete payment if you have not already, then our team will review your creative.</p>
  ${APP_WEB_CTA_HTML}
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const plainTitle = props.campaignTitle.trim() || 'Your promotion';
  const plainWho = (props.entityDisplayName ?? '').trim() || 'your account';
  const text = `We received your Hanar banner promotion request "${plainTitle}" for ${plainWho}.\n\n${APP_WEB_CTA_TEXT}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
