-- Fix claim_status for admin-added businesses (placeholder owner_id should stay claimable).
UPDATE public.businesses
SET claim_status = 'unclaimed'
WHERE admin_added_at IS NOT NULL
  AND (claim_status IS NULL OR claim_status = 'claimed');

COMMENT ON COLUMN public.businesses.claim_status IS
  'unclaimed | pending | claimed | rejected. Admin-added rows stay unclaimed until a real owner is approved.';
