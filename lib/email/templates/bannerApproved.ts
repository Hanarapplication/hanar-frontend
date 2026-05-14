/**
 * Admin approved a promotion request; banner is live (or linked feed banner created as active).
 */

export type BannerApprovedTemplateProps = {
  campaignTitle: string;
  entityDisplayName: string | null;
  dashboardPath?: string | null;
  origin?: string | null;
};

function absoluteHref(origin: string | null | undefined, path: string): string {
  const base = (origin ?? '').trim().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export function buildBannerApprovedEmail(props: BannerApprovedTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(props.campaignTitle.trim() || 'Your promotion');
  const who = escapeHtml((props.entityDisplayName ?? '').trim() || 'your account');
  const subject = 'Your Hanar banner promotion is approved';
  const dash = absoluteHref(props.origin, props.dashboardPath?.trim() || '/');
  const home = absoluteHref(props.origin, '/');

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p><strong>${title}</strong> for <strong>${who}</strong> was approved and is scheduled to run in the feed.</p>
  <p><a href="${home}">Visit Hanar</a> · <a href="${dash}">Your dashboard</a></p>
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const text = `Your Hanar banner promotion "${props.campaignTitle.trim() || 'Your promotion'}" for ${(props.entityDisplayName ?? '').trim() || 'your account'} was approved.\n${home}\n${dash}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
