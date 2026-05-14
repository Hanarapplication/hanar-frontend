/**
 * Seller submitted a new individual marketplace listing — under review before public visibility.
 */

export type MarketplaceSubmittedTemplateProps = {
  listingTitle: string;
};

export function buildMarketplaceSubmittedEmail(props: MarketplaceSubmittedTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(props.listingTitle.trim() || 'Your listing');
  const subject = 'Your Hanar marketplace listing is under review';

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p>Thanks for posting <strong>${title}</strong> on Hanar.</p>
  <p>Your listing is <strong>in review</strong> and is <strong>not visible to the public</strong> until our team approves it. We do this to help keep Hanar safe, respectful, and aligned with our community policies (including keeping adult or explicit content off the marketplace).</p>
  <p>Open the <strong>Hanar</strong> mobile app or sign in on our website and check your account or marketplace activity for status updates. We do not include listing links in these messages.</p>
  <p>You will receive another email when your listing is <strong>approved and visible</strong>, or if our team needs <strong>further information</strong> from you.</p>
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const plain = props.listingTitle.trim() || 'Your listing';
  const text = [
    `Hanar: "${plain}" was received and is under review.`,
    '',
    'It is not visible to the public until our team approves it. We review listings to help keep Hanar safe and within our policies.',
    '',
    'Open the Hanar mobile app or sign in on our website and check your account or marketplace activity for updates. We do not include listing links in these emails.',
    '',
    'You will get another email when your listing is approved and visible, or if we need further information.',
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
