/**
 * Placeholder content for “marketplace listing approved / live” email.
 */

export type MarketplaceApprovedTemplateProps = {
  listingTitle: string;
  /** Path (e.g. /marketplace/my-item-slug) or full URL to the listing. */
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

export function buildMarketplaceApprovedEmail(props: MarketplaceApprovedTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(props.listingTitle.trim() || 'Your listing');
  const subject = 'Your Hanar marketplace listing is live';
  const href = listingHref(props.origin, props.listingPath?.trim() || '/marketplace');

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p>Your listing <strong>${title}</strong> is now visible on Hanar.</p>
  <p><a href="${href}">View listing</a></p>
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const text = `Your Hanar listing "${props.listingTitle.trim() || 'Your listing'}" is live.\n${href}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
