/**
 * “Business approved” transactional email.
 */

export type BusinessApprovedTemplateProps = {
  businessName: string;
  /** Public slug (reserved for future use; not used in current copy). */
  slug?: string | null;
  /** Site origin (reserved for future deep links). */
  origin?: string | null;
};

const APP_WEB_CTA_HTML =
  '<p>Open the <strong>Hanar</strong> mobile app or visit our website while signed in to see your live profile, updates, and anything that needs your attention.</p>';

const APP_WEB_CTA_TEXT =
  'Open the Hanar mobile app or visit our website while signed in to see your live profile, updates, and anything that needs your attention.';

export function buildBusinessApprovedEmail(props: BusinessApprovedTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const name = escapeHtml(props.businessName.trim() || 'Your business');
  const subject = 'Your Hanar business is approved';

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p><strong>${name}</strong> has been approved on Hanar. Your business profile can appear to visitors according to your plan and settings.</p>
  ${APP_WEB_CTA_HTML}
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const plain = props.businessName.trim() || 'Your business';
  const text = `Your business "${plain}" has been approved on Hanar.\n\n${APP_WEB_CTA_TEXT}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
