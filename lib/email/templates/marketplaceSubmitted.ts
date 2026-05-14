/**
 * Seller submitted a new individual marketplace listing for moderation.
 */

export type MarketplaceSubmittedTemplateProps = {
  listingTitle: string;
  /** Path (e.g. /marketplace/individual-{uuid}) or full URL. */
  listingPath?: string | null;
  origin?: string | null;
};

function listingHref(origin: string | null | undefined, listingPath: string): string {
  const raw = listingPath.trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  const base = (origin ?? '').trim().replace(/\/$/, '');
  return base ? `${base}${path}` : path;
}

export function buildMarketplaceSubmittedEmail(props: MarketplaceSubmittedTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(props.listingTitle.trim() || 'Your listing');
  const subject = 'We received your Hanar marketplace listing';
  const href = listingHref(props.origin, props.listingPath?.trim() || '/marketplace');

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p>Thanks for posting <strong>${title}</strong> on Hanar. Our team may review it before it appears to everyone.</p>
  <p><a href="${href}">View your listing</a></p>
  <p>Open the <strong>Hanar</strong> mobile app or our website while signed in to track status and make edits.</p>
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const text = `We received your Hanar marketplace listing "${props.listingTitle.trim() || 'Your listing'}".\n${href}\n\nOpen the Hanar app or our website while signed in to track status and make edits.\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
