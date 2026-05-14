/**
 * Placeholder content for “business approved” transactional email.
 * Replace copy and layout when product/design finalizes.
 */

export type BusinessApprovedTemplateProps = {
  businessName: string;
  /** Public slug for deep link; optional if unknown. */
  slug?: string | null;
  /** Site origin (no trailing slash), e.g. from NEXT_PUBLIC_SITE_URL — used for absolute links in email clients. */
  origin?: string | null;
};

function absoluteHref(origin: string | null | undefined, path: string): string {
  const base = (origin ?? '').trim().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export function buildBusinessApprovedEmail(props: BusinessApprovedTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const name = escapeHtml(props.businessName.trim() || 'Your business');
  const subject = 'Your Hanar business is approved';

  const path = props.slug?.trim() ? `/business/${encodeURIComponent(props.slug.trim())}` : '/business-dashboard';
  const href = absoluteHref(props.origin, path);
  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p><strong>${name}</strong> has been approved on Hanar.</p>
  <p><a href="${href}">Open your business dashboard</a></p>
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const text = `Your business "${props.businessName.trim() || 'Your business'}" has been approved on Hanar.\nVisit: ${href}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
