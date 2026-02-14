-- Allow status 'pending_payment' so promotion requests are only reviewable after payment.
ALTER TABLE public.business_promotion_requests
  DROP CONSTRAINT IF EXISTS business_promotion_requests_status_check;
ALTER TABLE public.business_promotion_requests
  ADD CONSTRAINT business_promotion_requests_status_check
  CHECK (status IN ('pending_payment', 'pending_review', 'approved', 'rejected', 'active', 'expired'));

ALTER TABLE public.organization_promotion_requests
  DROP CONSTRAINT IF EXISTS organization_promotion_requests_status_check;
ALTER TABLE public.organization_promotion_requests
  ADD CONSTRAINT organization_promotion_requests_status_check
  CHECK (status IN ('pending_payment', 'pending_review', 'approved', 'rejected', 'active', 'expired'));
