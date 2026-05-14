/**
 * Admin rejected a promotion request.
 */

export type BannerRejectedTemplateProps = {
  campaignTitle: string;
  entityDisplayName: string | null;
  /** @deprecated No longer used in email copy; kept for call-site compatibility. */
  dashboardPath?: string | null;
  origin?: string | null;
};

const APP_WEB_CTA_HTML =
  '<p>Open the <strong>Hanar</strong> mobile app or our website, sign in, and review your promotion request or billing. Contact support from the app or site if you have questions.</p>';

const APP_WEB_CTA_TEXT =
  'Open the Hanar mobile app or our website, sign in, and review your promotion request or billing. Contact support from the app or site if you have questions.';

export function buildBannerRejectedEmail(props: BannerRejectedTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(props.campaignTitle.trim() || 'Your promotion');
  const who = escapeHtml((props.entityDisplayName ?? '').trim() || 'your account');
  const subject = 'Update on your Hanar banner promotion';

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p>We reviewed <strong>${title}</strong> (${who}) and it was not approved at this time.</p>
  ${APP_WEB_CTA_HTML}
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const plainTitle = props.campaignTitle.trim() || 'Your promotion';
  const plainWho = (props.entityDisplayName ?? '').trim() || 'your account';
  const text = `Update on Hanar: "${plainTitle}" (${plainWho}) was not approved.\n\n${APP_WEB_CTA_TEXT}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
