/**
 * Listing passed moderation (is_reviewed) but is not yet shown on the public marketplace
 * (e.g. still on hold until staff activates it).
 */

export type MarketplaceApprovedNotVisibleTemplateProps = {
  listingTitle: string;
};

export function buildMarketplaceApprovedNotVisibleEmail(props: MarketplaceApprovedNotVisibleTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(props.listingTitle.trim() || 'Your listing');
  const subject = 'Your Hanar marketplace listing was approved';

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p>Good news: our team has <strong>approved</strong> your listing <strong>${title}</strong> for Hanar’s marketplace.</p>
  <p>It is <strong>not visible to the public yet</strong> (for example, it may still be on hold while we finish a step). Open the <strong>Hanar</strong> mobile app or sign in on our website to check status. We do not include listing links in these messages.</p>
  <p>You will receive <strong>another email</strong> when your listing is <strong>live and visible</strong> to everyone on the marketplace.</p>
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const plain = props.listingTitle.trim() || 'Your listing';
  const text = [
    `Hanar: "${plain}" was approved by our team.`,
    '',
    'It is not visible to the public yet (for example, it may still be on hold). Open the Hanar app or our website to check status. We do not include listing links in these emails.',
    '',
    'You will get another email when your listing is live on the marketplace.',
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
