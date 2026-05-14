/**
 * Admin rejected a promotion request.
 */

export type BannerRejectedTemplateProps = {
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

export function buildBannerRejectedEmail(props: BannerRejectedTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const title = escapeHtml(props.campaignTitle.trim() || 'Your promotion');
  const who = escapeHtml((props.entityDisplayName ?? '').trim() || 'your account');
  const reasonRaw = (props.reason ?? '').trim();
  const reasonHtml = reasonRaw ? `<p><strong>Note:</strong> ${escapeHtml(reasonRaw)}</p>` : '';
  const subject = 'Update on your Hanar banner promotion';
  const dash = absoluteHref(props.origin, props.dashboardPath?.trim() || '/');

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p>We reviewed <strong>${title}</strong> (${who}) and it was not approved at this time.</p>
  ${reasonHtml}
  <p><a href="${dash}">Open your dashboard</a></p>
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const text = `Update on Hanar: "${props.campaignTitle.trim() || 'Your promotion'}" (${(props.entityDisplayName ?? '').trim() || 'your account'}) was not approved.${reasonRaw ? ` Note: ${reasonRaw}` : ''}\n${dash}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
