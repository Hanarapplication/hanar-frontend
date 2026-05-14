/**
 * Business or organization submitted a feed banner / promotion request (before or awaiting payment).
 */

export type BannerSubmittedTemplateProps = {
  campaignTitle: string;
  entityDisplayName: string | null;
  /** Path to seller dashboard (e.g. /business-dashboard). */
  dashboardPath?: string | null;
  origin?: string | null;
};

function absoluteHref(origin: string | null | undefined, path: string): string {
  const base = (origin ?? '').trim().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export function buildBannerSubmittedEmail(props: BannerSubmittedTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(props.campaignTitle.trim() || 'Your promotion');
  const who = escapeHtml((props.entityDisplayName ?? '').trim() || 'your account');
  const subject = 'We received your Hanar banner promotion request';
  const dash = absoluteHref(props.origin, props.dashboardPath?.trim() || '/');

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p>Thanks for submitting <strong>${title}</strong> for <strong>${who}</strong>.</p>
  <p>Complete payment if you have not already, then our team will review your creative.</p>
  <p><a href="${dash}">Open your dashboard</a></p>
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const text = `We received your Hanar banner promotion request "${props.campaignTitle.trim() || 'Your promotion'}" for ${(props.entityDisplayName ?? '').trim() || 'your account'}.\n${dash}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
