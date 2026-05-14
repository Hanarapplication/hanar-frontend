import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveMarketplaceSellerEmail } from './resolveMarketplaceSellerEmail';
import {
  sendMarketplaceApprovedEmail,
  sendMarketplaceApprovedNotVisibleEmail,
  sendMarketplaceItemDeletedEmail,
  sendMarketplaceOnHoldEmail,
  sendMarketplaceRejectedEmail,
  sendMarketplaceSubmittedEmail,
} from './transactional';

export type MarketplaceItemModerationRow = {
  id: string;
  user_id: string | null;
  title: string | null;
  is_on_hold: boolean;
  /** `false` = pending moderation; `null` = legacy / unspecified (treated as not pending for visibility). */
  is_reviewed: boolean | null;
};

function defaultOrigin(): string | undefined {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return u && u.length > 0 ? u.replace(/\/$/, '') : undefined;
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

  const title = args.listingTitle?.trim() || 'Your listing';
  try {
    const result = await sendMarketplaceSubmittedEmail(toEmail, {
      listingTitle: title,
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
 * After admin PATCH — on hold, approved-but-not-public, publicly visible, or review cleared to pending.
 */
export async function notifyMarketplaceItemModerationTransitions(
  supabaseAdmin: SupabaseClient,
  args: {
    before: MarketplaceItemModerationRow;
    after: MarketplaceItemModerationRow;
  }
): Promise<void> {
  const { before, after } = args;
  if (before.id !== after.id) return;

  const holdWas = Boolean(before.is_on_hold);
  const holdNow = Boolean(after.is_on_hold);

  const isPublicVisible = (row: MarketplaceItemModerationRow) => {
    if (row.is_on_hold) return false;
    if (row.is_reviewed === false) return false;
    return true;
  };
  const wasPublicVisible = isPublicVisible(before);
  const nowPublicVisible = isPublicVisible(after);

  const holdTurnedOn = !holdWas && holdNow;
  const publicVisibleTurnedOn = nowPublicVisible && !wasPublicVisible;
  const reviewedTurnedOff = before.is_reviewed !== false && after.is_reviewed === false;
  /** Pending → approved in the same update did not make the listing public (e.g. still on hold). */
  const approvedNotYetPublic =
    before.is_reviewed === false && after.is_reviewed === true && !publicVisibleTurnedOn;

  if (!holdTurnedOn && !publicVisibleTurnedOn && !reviewedTurnedOff && !approvedNotYetPublic) return;

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
        origin: origin ?? null,
        tags: tagId,
      })
    );
  }

  if (publicVisibleTurnedOn) {
    await safeSend('approved_visible', () =>
      sendMarketplaceApprovedEmail(toEmail!, {
        listingTitle: title,
        tags: tagId,
      })
    );
  } else if (approvedNotYetPublic) {
    await safeSend('approved_not_visible', () =>
      sendMarketplaceApprovedNotVisibleEmail(toEmail!, {
        listingTitle: title,
        tags: tagId,
      })
    );
  }

  if (reviewedTurnedOff) {
    await safeSend('rejected', () =>
      sendMarketplaceRejectedEmail(toEmail!, {
        listingTitle: title,
        origin: origin ?? null,
        tags: tagId,
      })
    );
  }
}

/**
 * After seller or admin archives a listing — does not throw.
 */
export async function notifyMarketplaceItemDeleted(
  supabaseAdmin: SupabaseClient,
  args: { userId: string | null; itemId: string; listingTitle: string; source: 'user' | 'admin' }
): Promise<void> {
  let toEmail: string | null;
  try {
    toEmail = await resolveMarketplaceSellerEmail(supabaseAdmin, args.userId);
  } catch {
    console.warn('[marketplace-item-email] deleted: recipient lookup failed');
    return;
  }
  if (!toEmail) {
    console.info('[marketplace-item-email] deleted: skipped (no recipient)');
    return;
  }

  const title = args.listingTitle?.trim() || 'Your listing';
  const ownerId = (args.userId || '').trim();
  const logUserId =
    ownerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId)
      ? ownerId
      : null;

  try {
    const result = await sendMarketplaceItemDeletedEmail(toEmail, {
      listingTitle: title,
      source: args.source,
      tags: [{ name: 'marketplace_item_id', value: args.itemId }],
      logUserId,
    });
    if (!result.success) {
      console.warn('[marketplace-item-email] deleted: send failed', { hasError: true });
    }
  } catch {
    console.warn('[marketplace-item-email] deleted: send threw');
  }
}
