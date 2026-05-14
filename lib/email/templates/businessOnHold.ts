/**
 * Business profile placed on hold / pending review.
 */

export type BusinessOnHoldTemplateProps = {
  businessName: string;
  /** Optional admin context (e.g. note from moderation action). */
  reason?: string | null;
  origin?: string | null;
};

function absoluteHref(origin: string | null | undefined, path: string): string {
  const base = (origin ?? '').trim().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export function buildBusinessOnHoldEmail(props: BusinessOnHoldTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const name = escapeHtml(props.businessName.trim() || 'Your business');
  const reasonRaw = (props.reason ?? '').trim();
  const reasonHtml = reasonRaw ? `<p><strong>Note:</strong> ${escapeHtml(reasonRaw)}</p>` : '';
  const subject = 'Your Hanar business profile is on hold';
  const dash = absoluteHref(props.origin, '/business-dashboard');

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p><strong>${name}</strong> is on hold on Hanar while we review or await updates.</p>
  ${reasonHtml}
  <p><a href="${dash}">Open your business dashboard</a></p>
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const text = `Hanar: "${props.businessName.trim() || 'Your business'}" is on hold.${reasonRaw ? ` Note: ${reasonRaw}` : ''}\n${dash}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
