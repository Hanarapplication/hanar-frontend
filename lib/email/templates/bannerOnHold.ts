/**
 * Linked feed banner was placed on hold (e.g. admin changed status from active to on_hold).
 */

export type BannerOnHoldTemplateProps = {
  campaignTitle: string;
  entityDisplayName: string | null;
  reason?: string | null;
  dashboardPath?: string | null;
  origin?: string | null;
};

function absoluteHref(origin: string | null | undefined, path: string): string {
  const base = (origin ?? '').trim().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export function buildBannerOnHoldEmail(props: BannerOnHoldTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(props.campaignTitle.trim() || 'Your promotion');
  const who = escapeHtml((props.entityDisplayName ?? '').trim() || 'your account');
  const reasonRaw = (props.reason ?? '').trim();
  const reasonHtml = reasonRaw ? `<p><strong>Note:</strong> ${escapeHtml(reasonRaw)}</p>` : '';
  const subject = 'Your Hanar feed banner is on hold';
  const dash = absoluteHref(props.origin, props.dashboardPath?.trim() || '/');

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p><strong>${title}</strong> (${who}) is <strong>on hold</strong> in the feed while we review or await updates.</p>
  ${reasonHtml}
  <p><a href="${dash}">Open your dashboard</a></p>
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const text = `Hanar: "${props.campaignTitle.trim() || 'Your promotion'}" (${(props.entityDisplayName ?? '').trim() || 'your account'}) is on hold in the feed.${reasonRaw ? ` Note: ${reasonRaw}` : ''}\n${dash}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
