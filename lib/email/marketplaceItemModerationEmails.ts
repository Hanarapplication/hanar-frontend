import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveMarketplaceSellerEmail } from './resolveMarketplaceSellerEmail';
import {
  sendMarketplaceApprovedEmail,
  sendMarketplaceOnHoldEmail,
  sendMarketplaceRejectedEmail,
  sendMarketplaceSubmittedEmail,
} from './transactional';

export type MarketplaceItemModerationRow = {
  id: string;
  user_id: string | null;
  title: string | null;
  is_on_hold: boolean;
  is_reviewed: boolean;
};

function defaultOrigin(): string | undefined {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return u && u.length > 0 ? u.replace(/\/$/, '') : undefined;
}

function listingPathForItem(id: string): string {
  return `/marketplace/individual-${id}`;
}

/**
 * After a successful insert — does not throw; logs safe metadata only.
 */
export async function notifyMarketplaceItemSubmitted(
  supabaseAdmin: SupabaseClient,
  args: { userId: string; itemId: string; listingTitle: string }
): Promise<void> {
  let toEmail: string | null;
  try {
    toEmail = await resolveMarketplaceSellerEmail(supabaseAdmin, args.userId);
  } catch {
    console.warn('[marketplace-item-email] submitted: recipient lookup failed');
    return;
  }
  if (!toEmail) {
    console.info('[marketplace-item-email] submitted: skipped (no recipient)');
    return;
  }

  const origin = defaultOrigin();
  const title = args.listingTitle?.trim() || 'Your listing';
  try {
    const result = await sendMarketplaceSubmittedEmail(toEmail, {
      listingTitle: title,
      listingPath: listingPathForItem(args.itemId),
      origin,
      tags: [{ name: 'marketplace_item_id', value: args.itemId }],
    });
    if (!result.success) {
      console.warn('[marketplace-item-email] submitted: send failed', { hasError: true });
    }
  } catch {
    console.warn('[marketplace-item-email] submitted: send threw');
  }
}

/**
 * After admin PATCH — sends only when `is_on_hold` / `is_reviewed` actually change.
 * Rejected = reviewed → not reviewed (see admin “Unreview”); optional `moderation_note` on the request body is included for rejected and on-hold.
 */
export async function notifyMarketplaceItemModerationTransitions(
  supabaseAdmin: SupabaseClient,
  args: {
    before: MarketplaceItemModerationRow;
    after: MarketplaceItemModerationRow;
    moderationNote?: string | null;
  }
): Promise<void> {
  const { before, after } = args;
  const note = (args.moderationNote ?? '').trim() || null;
  if (before.id !== after.id) return;

  const holdWas = Boolean(before.is_on_hold);
  const holdNow = Boolean(after.is_on_hold);
  const reviewedWas = Boolean(before.is_reviewed);
  const reviewedNow = Boolean(after.is_reviewed);

  const holdTurnedOn = !holdWas && holdNow;
  const reviewedTurnedOn = !reviewedWas && reviewedNow;
  const reviewedTurnedOff = reviewedWas && !reviewedNow;

  if (!holdTurnedOn && !reviewedTurnedOn && !reviewedTurnedOff) return;

  let toEmail: string | null;
  try {
    toEmail = await resolveMarketplaceSellerEmail(supabaseAdmin, after.user_id);
  } catch {
    console.warn('[marketplace-item-email] moderation: recipient lookup failed');
    return;
  }
  if (!toEmail) {
    console.info('[marketplace-item-email] moderation: skipped (no recipient)');
    return;
  }

  const origin = defaultOrigin();
  const title = after.title?.trim() || 'Your listing';
  const path = listingPathForItem(after.id);
  const tagId = [{ name: 'marketplace_item_id', value: after.id }];

  const safeSend = async (label: string, fn: () => Promise<{ success: boolean }>) => {
    try {
      const result = await fn();
      if (!result.success) {
        console.warn(`[marketplace-item-email] ${label}: send failed`, { hasError: true });
      }
    } catch {
      console.warn(`[marketplace-item-email] ${label}: send threw`);
    }
  };

  if (holdTurnedOn) {
    await safeSend('on_hold', () =>
      sendMarketplaceOnHoldEmail(toEmail!, {
        listingTitle: title,
        reason: note,
        origin: origin ?? null,
        tags: tagId,
      })
    );
  }

  if (reviewedTurnedOn) {
    await safeSend('approved', () =>
      sendMarketplaceApprovedEmail(toEmail!, {
        listingTitle: title,
        listingPath: path,
        origin,
        tags: tagId,
      })
    );
  }

  if (reviewedTurnedOff) {
    await safeSend('rejected', () =>
      sendMarketplaceRejectedEmail(toEmail!, {
        listingTitle: title,
        reason: note,
        origin: origin ?? null,
        tags: tagId,
      })
    );
  }
}
