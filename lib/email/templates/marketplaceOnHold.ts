/**
 * Individual marketplace listing placed on hold (hidden from public marketplace).
 */

export type MarketplaceOnHoldTemplateProps = {
  listingTitle: string;
  /** Optional admin context (e.g. note from moderation action). */
  reason?: string | null;
  origin?: string | null;
};

function absoluteHref(origin: string | null | undefined, path: string): string {
  const base = (origin ?? '').trim().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export function buildMarketplaceOnHoldEmail(props: MarketplaceOnHoldTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(props.listingTitle.trim() || 'Your listing');
  const reasonRaw = (props.reason ?? '').trim();
  const reasonHtml = reasonRaw ? `<p><strong>Note:</strong> ${escapeHtml(reasonRaw)}</p>` : '';
  const subject = 'Your Hanar marketplace listing is on hold';
  const dash = absoluteHref(props.origin, '/dashboard');

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p><strong>${title}</strong> is on hold on Hanar and is hidden from the public marketplace while we review or await updates.</p>
  ${reasonHtml}
  <p><a href="${dash}">Open your dashboard</a></p>
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const text = `Hanar: "${props.listingTitle.trim() || 'Your listing'}" is on hold (hidden from the marketplace).${reasonRaw ? ` Note: ${reasonRaw}` : ''}\n${dash}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
