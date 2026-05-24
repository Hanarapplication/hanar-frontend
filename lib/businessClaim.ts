/** Row fields used to decide if a real owner can submit a claim. */
export type BusinessClaimFields = {
  owner_id?: string | null;
  admin_added_at?: string | null;
  claim_status?: string | null;
};

/**
 * A business is claimable when:
 * - it has no owner (imported listings), or
 * - it was admin-added with a placeholder account (admin_added_at) and not yet claimed.
 */
export function isClaimableBusiness(biz: BusinessClaimFields | null | undefined): boolean {
  if (!biz) return false;
  if (biz.claim_status === 'claimed') return false;
  if (!biz.owner_id) return true;
  return Boolean(biz.admin_added_at);
}

/** Show claim UI (banner/button). Hide when someone else's claim is pending review. */
export function showBusinessClaimUi(
  biz: BusinessClaimFields | null | undefined,
  userClaimStatus?: 'pending' | 'approved' | 'rejected' | null
): boolean {
  if (!isClaimableBusiness(biz)) return false;
  if (biz?.claim_status === 'pending' && userClaimStatus !== 'pending') return false;
  return true;
}

/** Public profile visibility for on_hold listings. */
export function isPubliclyVisibleBusiness(biz: {
  moderation_status?: string | null;
  owner_id?: string | null;
  admin_added_at?: string | null;
  is_archived?: boolean | null;
  lifecycle_status?: string | null;
}): boolean {
  if (biz.is_archived || biz.lifecycle_status === 'archived') return false;
  if (biz.moderation_status === 'active') return true;
  if (biz.moderation_status === 'on_hold') {
    if (!biz.owner_id) return true;
    if (biz.admin_added_at) return true;
  }
  return false;
}
