/**
 * “Business rejected / needs changes” email.
 */

export type BusinessRejectedTemplateProps = {
  businessName: string;
  origin?: string | null;
};

const APP_WEB_CTA_HTML =
  '<p>Open the <strong>Hanar</strong> mobile app or our website, sign in, and review your business profile. You can also reach out to support from there if you have questions.</p>';

const APP_WEB_CTA_TEXT =
  'Open the Hanar mobile app or our website, sign in, and review your business profile. Contact support from the app or site if you have questions.';

export function buildBusinessRejectedEmail(props: BusinessRejectedTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const name = escapeHtml(props.businessName.trim() || 'Your business');
  const subject = 'Update on your Hanar business application';

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p>We reviewed <strong>${name}</strong> on Hanar and it was not approved at this time.</p>
  ${APP_WEB_CTA_HTML}
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const plain = props.businessName.trim() || 'Your business';
  const text = `Update on Hanar: "${plain}" was not approved.\n\n${APP_WEB_CTA_TEXT}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
