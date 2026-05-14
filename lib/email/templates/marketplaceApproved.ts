/**
 * Marketplace listing is approved and visible (not on hold).
 */

export type MarketplaceApprovedTemplateProps = {
  listingTitle: string;
};

export function buildMarketplaceApprovedEmail(props: MarketplaceApprovedTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(props.listingTitle.trim() || 'Your listing');
  const subject = 'Your Hanar marketplace listing is now visible';

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p>Good news: <strong>${title}</strong> is <strong>approved</strong> and <strong>visible on Hanar</strong> for other members to discover.</p>
  <p>Open the <strong>Hanar</strong> mobile app or sign in on our website to view or manage your listing. We do not include listing links in these messages.</p>
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const plain = props.listingTitle.trim() || 'Your listing';
  const text = [
    `Hanar: "${plain}" is approved and visible on the marketplace.`,
    '',
    'Open the Hanar mobile app or sign in on our website to view or manage your listing. We do not include listing links in these emails.',
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
