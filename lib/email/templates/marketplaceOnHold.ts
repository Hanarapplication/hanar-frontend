/**
 * Individual marketplace listing placed on hold (hidden from public marketplace).
 */

export type MarketplaceOnHoldTemplateProps = {
  listingTitle: string;
  origin?: string | null;
};

export function buildMarketplaceOnHoldEmail(props: MarketplaceOnHoldTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(props.listingTitle.trim() || 'Your listing');
  const subject = 'Your Hanar marketplace listing is on hold';

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p><strong>${title}</strong> is <strong>on hold</strong> on Hanar and is hidden from the public marketplace while we review or await updates.</p>
  <p>This often means we need to verify something about the listing—details, policy fit, or a routine review. It does not always mean you did something wrong.</p>
  <p>Open the <strong>Hanar</strong> mobile app or our website, sign in, and check your marketplace activity for updates. Watch <strong>this inbox</strong> for follow-up email if we need anything else.</p>
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const plain = props.listingTitle.trim() || 'Your listing';
  const text = [
    `Hanar: "${plain}" is on hold (hidden from the marketplace).`,
    '',
    'We may need to verify details or policy fit; that does not always mean you did something wrong.',
    '',
    'Open the Hanar app or our website, sign in, and check your marketplace activity for updates. Watch this inbox for follow-up messages.',
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
