/**
 * Send pre-written approval notifications (in-app + push) when a business,
 * promotion, or area blast is approved. Used by admin approval flows.
 */

import { createClient } from '@supabase/supabase-js';
import { isPushConfigured, sendPushToTokens } from '@/lib/firebaseAdmin';

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
 * Resolve recipient user_id and message content for the given approval type and id.
 * Returns null if not found or no recipient.
 */
async function resolveApprovalPayload(
  type: ApprovalType,
  id: string,
  options?: SendApprovalOptions
): Promise<{ user_id: string; title: string; body: string; url: string | null } | null> {
  if (type === 'business') {
    const { data: biz, error } = await supabaseAdmin
      .from('businesses')
      .select('owner_id, slug, business_name')
      .eq('id', id)
      .single();
    if (error || !biz?.owner_id) return null;
    const slug = biz.slug || '';
    return {
      user_id: biz.owner_id,
      title: 'Your business is approved',
      body: "Your business is approved and it's live on Hanar. View your page.",
      url: slug ? `/business/${slug}` : '/business-dashboard',
    };
  }

  if (type === 'promotion') {
    const { data: reqRow, error: reqErr } = await supabaseAdmin
      .from('business_promotion_requests')
      .select('business_id')
      .eq('id', id)
      .single();
    if (reqErr || !reqRow?.business_id) return null;
    const { data: biz, error: bizErr } = await supabaseAdmin
      .from('businesses')
      .select('owner_id, slug')
      .eq('id', reqRow.business_id)
      .single();
    if (bizErr || !biz?.owner_id) return null;
    const slug = biz.slug || '';
    return {
      user_id: biz.owner_id,
      title: 'Your promotion is live',
      body: 'Your advertisement banner is now live in the feed.',
      url: slug ? `/business/${slug}` : '/business-dashboard',
    };
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
    const body =
      sentCount > 0
        ? `Your area blast was approved and sent to ${sentCount} user${sentCount === 1 ? '' : 's'}.`
        : 'Your area blast was approved and sent.';
    const slug = biz.slug || '';
    return {
      user_id: biz.owner_id,
      title: 'Your area blast is live',
      body,
      url: slug ? `/business/${slug}` : '/business-dashboard',
    };
  }

  return null;
}

/**
 * Get push tokens for a user (web + app).
 */
async function getPushTokensForUser(userId: string): Promise<string[]> {
  const [appRes, webRes] = await Promise.all([
    supabaseAdmin.from('user_push_tokens').select('token').eq('user_id', userId),
    supabaseAdmin.from('push_tokens').select('token').eq('user_id', userId),
  ]);
  const appTokens = (appRes.data || []).map((r: { token: string }) => r.token).filter(Boolean);
  const webTokens = webRes.error ? [] : (webRes.data || []).map((r: { token: string }) => r.token).filter(Boolean);
  return Array.from(new Set([...appTokens, ...webTokens]));
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

    const row = {
      user_id: payload.user_id,
      type: 'approval',
      title: payload.title,
      body: payload.body,
      url: payload.url,
      data: { approval_type: type, approval_id: id },
    };

    const { error: insertError } = await supabaseAdmin.from('notifications').insert(row);
    if (insertError) {
      return { sent: false, error: insertError.message };
    }

    const tokens = await getPushTokensForUser(payload.user_id);
    if (tokens.length > 0 && isPushConfigured()) {
      await sendPushToTokens(payload.title, payload.body, payload.url, tokens);
    }

    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { sent: false, error: message };
  }
}
