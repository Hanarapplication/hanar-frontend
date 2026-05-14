/**
 * Linked feed banner was placed on hold (e.g. admin changed status from active to on_hold).
 */

export type BannerOnHoldTemplateProps = {
  campaignTitle: string;
  entityDisplayName: string | null;
  /** @deprecated No longer used in email copy; kept for call-site compatibility. */
  dashboardPath?: string | null;
  origin?: string | null;
};

export function buildBannerOnHoldEmail(props: BannerOnHoldTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(props.campaignTitle.trim() || 'Your promotion');
  const who = escapeHtml((props.entityDisplayName ?? '').trim() || 'your account');
  const subject = 'Your Hanar feed banner is on hold';

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p><strong>${title}</strong> (${who}) is <strong>on hold</strong> in the feed while we review or await updates.</p>
  <p>Open the <strong>Hanar</strong> mobile app or our website, sign in, and check your promotions for the latest status. Watch <strong>this inbox</strong> for follow-up email.</p>
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const plainTitle = props.campaignTitle.trim() || 'Your promotion';
  const plainWho = (props.entityDisplayName ?? '').trim() || 'your account';
  const text = [
    `Hanar: "${plainTitle}" (${plainWho}) is on hold in the feed.`,
    '',
    'Open the Hanar app or our website, sign in, and check your promotions for updates. Watch this inbox for follow-up messages.',
  ].join('\n');

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
