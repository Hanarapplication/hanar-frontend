/**
 * Business profile placed on hold / pending review.
 */

export type BusinessOnHoldTemplateProps = {
  businessName: string;
  /** Reserved for future use (e.g. absolute links); not required for current copy. */
  origin?: string | null;
};

export function buildBusinessOnHoldEmail(props: BusinessOnHoldTemplateProps): {
  subject: string;
  html: string;
  text: string;
} {
  const name = escapeHtml(props.businessName.trim() || 'Your business');
  const subject = 'Your Hanar business profile is on hold';

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi,</p>
  <p><strong>${name}</strong> has been placed <strong>on hold</strong> on Hanar. Your listing may be hidden or limited for visitors until we finish our review.</p>
  <p>This usually means we need to look into something about your profile—such as the accuracy of your details, how it fits our guidelines, or a routine technical or quality check. It does not always mean you did something wrong; sometimes we just need a bit more information or a quick fix on our side.</p>
  <p>Please open the <strong>Hanar</strong> mobile app or our website, sign in, and check for updates—status, tasks, and messages usually show there first. Also watch <strong>this email inbox</strong>: we may send follow-up messages with more detail or clear next steps.</p>
  <p style="color:#666;font-size:12px;">This is an automated message from Hanar.</p>
</body></html>`.trim();

  const plainName = props.businessName.trim() || 'Your business';
  const text = [
    `Hanar: "${plainName}" has been placed on hold.`,
    '',
    'Your listing may be hidden or limited while we review it. We may need to verify details, policy fit, or run a routine technical or quality review—that does not always mean you did something wrong.',
    '',
    'Open the Hanar app or our website, sign in, and check for updates. Watch this inbox for follow-up email with more explanation or next steps.',
  ].join('\n');

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
