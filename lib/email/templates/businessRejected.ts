/**
 * Placeholder content for “business rejected / needs changes” email.
 */

export type BusinessRejectedTemplateProps = {
  businessName: string;
  /** Optional short reason shown to the owner (avoid internal admin jargon). */
  reason?: string | null;
  origin?: string | null;
};

function absoluteHref(origin: string | null | undefined, path: string): string {
  const base = (origin ?? '').trim().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export function buildBusinessRejectedEmail(props: BusinessRejectedTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const name = escapeHtml(props.businessName.trim() || 'Your business');
  const reasonRaw = (props.reason ?? '').trim();
  const reasonHtml = reasonRaw ? `<p><strong>Note:</strong> ${escapeHtml(reasonRaw)}</p>` : '';
  const subject = 'Update on your Hanar business application';

  const signIn = absoluteHref(props.origin, '/login');
  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p>We reviewed <strong>${name}</strong> on Hanar and it was not approved at this time.</p>
  ${reasonHtml}
  <p>You can <a href="${signIn}">sign in to Hanar</a> to review your profile and contact support if you have questions.</p>
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const text = `Update on Hanar: "${props.businessName.trim() || 'Your business'}" was not approved.${reasonRaw ? ` Note: ${reasonRaw}` : ''}\nSign in: ${signIn}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
