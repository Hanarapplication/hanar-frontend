import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveBusinessContactEmail } from './resolveBusinessContactEmail';
import {
  sendBusinessApprovedEmail,
  sendBusinessOnHoldEmail,
  sendBusinessRejectedEmail,
} from './transactional';

export type BusinessModerationStatus = 'on_hold' | 'active' | 'rejected';

function normalizeModeration(value: string | null | undefined): BusinessModerationStatus | null {
  if (value === 'on_hold' || value === 'active' || value === 'rejected') return value;
  return null;
}

/**
 * Sends one transactional email when `moderation_status` actually changes.
 * Does not throw; logs only safe metadata on failure.
 */
export async function notifyBusinessModerationTransition(
  supabaseAdmin: SupabaseClient,
  args: {
    fromModeration: string | null | undefined;
    toModeration: string | null | undefined;
    businessName: string;
    slug: string | null | undefined;
    ownerId: string | null | undefined;
    rowEmail: string | null | undefined;
    /** Admin note / note-to-save when rejecting or placing on hold. */
    reason?: string | null;
  }
): Promise<void> {
  const from = normalizeModeration(args.fromModeration);
  const to = normalizeModeration(args.toModeration);
  if (!to || from === to) return;

  let toEmail: string | null;
  try {
    toEmail = await resolveBusinessContactEmail(supabaseAdmin, {
      email: args.rowEmail,
      owner_id: args.ownerId ?? null,
    });
  } catch {
    console.warn('[business-moderation-email] recipient lookup failed');
    return;
  }

  if (!toEmail) {
    console.info('[business-moderation-email] skipped: no recipient');
    return;
  }

  const name = args.businessName?.trim() || 'Your business';
  const slug = args.slug?.trim() || null;
  const reason = args.reason?.trim() || null;

  try {
    if (to === 'active') {
      const result = await sendBusinessApprovedEmail(toEmail, { businessName: name, slug });
      if (!result.success) {
        console.warn('[business-moderation-email] approved send failed', { hasError: true });
      }
      return;
    }
    if (to === 'rejected') {
      const result = await sendBusinessRejectedEmail(toEmail, {
        businessName: name,
        reason,
      });
      if (!result.success) {
        console.warn('[business-moderation-email] rejected send failed', { hasError: true });
      }
      return;
    }
    if (to === 'on_hold') {
      const result = await sendBusinessOnHoldEmail(toEmail, {
        businessName: name,
        reason,
      });
      if (!result.success) {
        console.warn('[business-moderation-email] on_hold send failed', { hasError: true });
      }
    }
  } catch {
    console.warn('[business-moderation-email] send threw');
  }
}
