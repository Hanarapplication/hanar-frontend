/**
 * Listing moved out of the reviewed / approved moderation state (e.g. admin “Unreview” or policy action).
 */

export type MarketplaceRejectedTemplateProps = {
  listingTitle: string;
  origin?: string | null;
};

const APP_WEB_CTA_HTML =
  '<p>Open the <strong>Hanar</strong> mobile app or our website, sign in, and review your marketplace listing. Contact support from the app or site if you have questions.</p><p>Watch <strong>this inbox</strong> if our team needs further information.</p>';

const APP_WEB_CTA_TEXT =
  'Open the Hanar mobile app or our website, sign in, and review your marketplace listing. Contact support from the app or site if you have questions. Watch this inbox if our team needs further information.';

export function buildMarketplaceRejectedEmail(props: MarketplaceRejectedTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(props.listingTitle.trim() || 'Your listing');
  const subject = 'Update on your Hanar marketplace listing';

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p>We reviewed <strong>${title}</strong> and it is not in an approved review state on Hanar at this time.</p>
  ${APP_WEB_CTA_HTML}
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const plain = props.listingTitle.trim() || 'Your listing';
  const text = `Update on Hanar: "${plain}" is no longer in an approved review state.\n\n${APP_WEB_CTA_TEXT}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
