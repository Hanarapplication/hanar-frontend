/**
 * Send pre-written approval notifications (in-app + push) when a business,
 * promotion, or area blast is approved. Used by admin approval flows.
 */

import {
  buildBusinessApprovedPushContent,
  isPushConfigured,
  sendPushToTokensBuilt,
  truncateForPushBody,
  type HanarPushBuilt,
} from '@/lib/firebaseAdmin';
import { getPushTokensForUser, isPushEnabledForUser } from '@/lib/pushForUsers';
import { isAdminAddedAccount } from '@/lib/adminAddedAccounts';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export type ApprovalType = 'business' | 'promotion' | 'area_blast';

export interface SendApprovalOptions {
  /** For area_blast: number of users the blast was sent to */
  sentCount?: number;
}

/**
 * Resolve recipient user_id and FCM payload for the given approval type and id.
 * Returns null if not found or no recipient.
 */
async function resolveApprovalPayload(
  type: ApprovalType,
  id: string,
  options?: SendApprovalOptions
): Promise<{ user_id: string; push: HanarPushBuilt } | null> {
  if (type === 'business') {
    const { data: biz, error } = await supabaseAdmin
      .from('businesses')
      .select('owner_id, slug, business_name, admin_added_at')
      .eq('id', id)
      .single();
    if (error || !biz?.owner_id || isAdminAddedAccount(biz)) return null;
    return {
      user_id: biz.owner_id,
      push: buildBusinessApprovedPushContent({
        businessName: biz.business_name,
        slug: biz.slug,
      }),
    };
  }

  if (type === 'promotion') {
    const { data: reqRow, error: reqErr } = await supabaseAdmin
      .from('business_promotion_requests')
      .select('business_id')
      .eq('id', id)
      .maybeSingle();
    if (!reqErr && reqRow?.business_id) {
      const { data: biz, error: bizErr } = await supabaseAdmin
        .from('businesses')
        .select('owner_id, slug')
        .eq('id', reqRow.business_id)
        .single();
      if (bizErr || !biz?.owner_id) return null;
      const slug = (biz.slug || '').trim();
      const linkPath = slug ? `/business/${slug}` : '/business-dashboard';
      return {
        user_id: biz.owner_id,
        push: {
          title: truncateForPushBody('Your promotion is live', 140),
          body: truncateForPushBody('Your advertisement banner is now live in the feed.', 1000),
          linkPath,
          type: 'promotion_approved',
        },
      };
    }

    const { data: orgReqRow, error: orgReqErr } = await supabaseAdmin
      .from('organization_promotion_requests')
      .select('organization_id')
      .eq('id', id)
      .maybeSingle();
    if (!orgReqErr && orgReqRow?.organization_id) {
      const { data: org, error: orgErr } = await supabaseAdmin
        .from('organizations')
        .select('user_id, username')
        .eq('id', orgReqRow.organization_id)
        .single();
      if (orgErr || !org?.user_id) return null;
      const username = (org.username || '').trim();
      const linkPath = username ? `/organization/${username}` : '/organization/dashboard';
      return {
        user_id: org.user_id,
        push: {
          title: truncateForPushBody('Your promotion is live', 140),
          body: truncateForPushBody('Your organization banner is now live in the feed.', 1000),
          linkPath,
          type: 'promotion_approved',
        },
      };
    }

    return null;
  }

  if (type === 'area_blast') {
    const { data: blast, error: blastErr } = await supabaseAdmin
      .from('area_blast_outbox')
      .select('business_id')
      .eq('id', id)
      .single();
    if (blastErr || !blast?.business_id) return null;
    const { data: biz, error: bizErr } = await supabaseAdmin
      .from('businesses')
      .select('owner_id, slug')
      .eq('id', blast.business_id)
      .single();
    if (bizErr || !biz?.owner_id) return null;
    const sentCount = options?.sentCount ?? 0;
    const bodyText =
      sentCount > 0
        ? `Your area blast was approved and sent to ${sentCount} user${sentCount === 1 ? '' : 's'}.`
        : 'Your area blast was approved and sent.';
    const slug = (biz.slug || '').trim();
    const linkPath = slug ? `/business/${slug}` : '/business-dashboard';
    return {
      user_id: biz.owner_id,
      push: {
        title: truncateForPushBody('Your area blast is live', 140),
        body: truncateForPushBody(bodyText, 1000),
        linkPath,
        type: 'area_blast_approved',
      },
    };
  }

  return null;
}

/**
 * Send in-app notification and push for an approval event.
 * Safe to call from API routes; logs errors but does not throw.
 */
export async function sendApprovalNotification(
  type: ApprovalType,
  id: string,
  options?: SendApprovalOptions
): Promise<{ sent: boolean; error?: string }> {
  try {
    const payload = await resolveApprovalPayload(type, id, options);
    if (!payload) {
      return { sent: false, error: 'Recipient or entity not found' };
    }

    const { push } = payload;
    const row = {
      user_id: payload.user_id,
      type: 'approval',
      title: push.title,
      body: push.body,
      url: push.linkPath,
      data: { approval_type: type, approval_id: id },
    };

    const { error: insertError } = await supabaseAdmin.from('notifications').insert(row);
    if (insertError) {
      return { sent: false, error: insertError.message };
    }

    const tokens = await getPushTokensForUser(payload.user_id);
    if (tokens.length > 0 && isPushConfigured() && (await isPushEnabledForUser(payload.user_id))) {
      await sendPushToTokensBuilt(push, tokens);
    }

    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { sent: false, error: message };
  }
}
