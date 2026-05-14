/**
 * Placeholder content for Stripe / checkout payment receipt email.
 */

export type PaymentReceiptTemplateProps = {
  /** e.g. business_plan, casual_pack, promotion */
  productType: string;
  /** Short human label, e.g. "Growth plan", "Casual Seller Pack" */
  productLabel: string;
  /** ISO currency code */
  currency?: string;
  /** Amount in major units for display (caller formats from Stripe cents if needed). */
  amountDisplay: string;
  /** Optional line, e.g. "Business: Acme Co" */
  detailLine?: string | null;
  /** Optional absolute URL (e.g. dashboard) */
  dashboardUrl?: string | null;
};

export function buildPaymentReceiptEmail(props: PaymentReceiptTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const label = escapeHtml(props.productLabel.trim() || 'Hanar purchase');
  const subject = 'Hanar — payment received';
  const type = escapeHtml(props.productType.trim() || 'purchase');
  const cur = (props.currency ?? 'USD').toUpperCase();
  const detailRaw = (props.detailLine ?? '').trim();
  const detailHtml = detailRaw ? `<p>${escapeHtml(detailRaw)}</p>` : '';
  const dashRaw = (props.dashboardUrl ?? '').trim();
  const dashHtml = dashRaw
    ? `<p><a href="${escapeHtml(dashRaw)}">Open your Hanar dashboard</a></p>`
    : '';

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p>Thank you — we received your payment for <strong>${label}</strong>.</p>
  <p>Type: ${type} · Amount: ${escapeHtml(props.amountDisplay)} ${cur}</p>
  ${detailHtml}
  ${dashHtml}
  <p style="color:#666;font-size:12px;">This is an automated receipt from Hanar.</p>
</body></html>`.trim();

  const text = `Hanar payment received: ${props.productLabel} (${props.productType}). Amount: ${props.amountDisplay} ${cur}.${detailRaw ? ` ${detailRaw}` : ''}${dashRaw ? ` ${dashRaw}` : ''}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
