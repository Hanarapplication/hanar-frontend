/**
 * Seller’s individual marketplace listing was removed (archived).
 */

export type MarketplaceItemDeletedTemplateProps = {
  listingTitle: string;
  /** 'user' = you removed it; 'admin' = removed by Hanar team */
  source: 'user' | 'admin';
};

export function buildMarketplaceItemDeletedEmail(props: MarketplaceItemDeletedTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(props.listingTitle.trim() || 'Your listing');
  const subject = 'Your Hanar marketplace listing was removed';
  const intro =
    props.source === 'admin'
      ? `Your listing <strong>${title}</strong> has been <strong>removed from Hanar</strong> by our team and is no longer visible on the marketplace.`
      : `Your listing <strong>${title}</strong> has been <strong>removed from Hanar</strong> as you requested. It is no longer visible on the marketplace.`;

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p>${intro}</p>
  <p>Open the <strong>Hanar</strong> mobile app or sign in on our website to manage your account or post a new listing later. We do not include listing links in these messages.</p>
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const plain = props.listingTitle.trim() || 'Your listing';
  const text =
    props.source === 'admin'
      ? `Hanar: "${plain}" was removed from the marketplace by our team.\n\nOpen the Hanar app or our website to manage your account. We do not include listing links in these emails.\n`
      : `Hanar: "${plain}" was removed from the marketplace as you requested.\n\nOpen the Hanar app or our website to manage your account. We do not include listing links in these emails.\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
