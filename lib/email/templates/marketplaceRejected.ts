/**
 * Listing moved out of the reviewed / approved moderation state (e.g. admin “Unreview” or policy action).
 */

export type MarketplaceRejectedTemplateProps = {
  listingTitle: string;
  /** Optional note from moderation (shown to the seller). */
  reason?: string | null;
  origin?: string | null;
};

function absoluteHref(origin: string | null | undefined, path: string): string {
  const base = (origin ?? '').trim().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export function buildMarketplaceRejectedEmail(props: MarketplaceRejectedTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(props.listingTitle.trim() || 'Your listing');
  const reasonRaw = (props.reason ?? '').trim();
  const reasonHtml = reasonRaw ? `<p><strong>Note:</strong> ${escapeHtml(reasonRaw)}</p>` : '';
  const subject = 'Update on your Hanar marketplace listing';
  const signIn = absoluteHref(props.origin, '/login');

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p>We reviewed <strong>${title}</strong> and it is not in an approved review state on Hanar at this time.</p>
  ${reasonHtml}
  <p>You can <a href="${signIn}">sign in to Hanar</a> to review your listing and contact support if you have questions.</p>
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const text = `Update on Hanar: "${props.listingTitle.trim() || 'Your listing'}" is no longer in an approved review state.${reasonRaw ? ` Note: ${reasonRaw}` : ''}\nSign in: ${signIn}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
