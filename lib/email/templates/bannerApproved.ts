/**
 * Admin approved a promotion request; banner is live (or linked feed banner created as active).
 */

export type BannerApprovedTemplateProps = {
  campaignTitle: string;
  entityDisplayName: string | null;
  /** @deprecated No longer used in email copy; kept for call-site compatibility. */
  dashboardPath?: string | null;
  origin?: string | null;
};

const APP_WEB_CTA_HTML =
  '<p>Open the <strong>Hanar</strong> mobile app or our website while signed in to track your promotion, billing, and feed status.</p>';

const APP_WEB_CTA_TEXT =
  'Open the Hanar mobile app or our website while signed in to track your promotion, billing, and feed status.';

export function buildBannerApprovedEmail(props: BannerApprovedTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(props.campaignTitle.trim() || 'Your promotion');
  const who = escapeHtml((props.entityDisplayName ?? '').trim() || 'your account');
  const subject = 'Your Hanar banner promotion is approved';

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p><strong>${title}</strong> for <strong>${who}</strong> was approved and is scheduled to run in the feed.</p>
  ${APP_WEB_CTA_HTML}
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const plainTitle = props.campaignTitle.trim() || 'Your promotion';
  const plainWho = (props.entityDisplayName ?? '').trim() || 'your account';
  const text = `Your Hanar banner promotion "${plainTitle}" for ${plainWho} was approved.\n\n${APP_WEB_CTA_TEXT}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
