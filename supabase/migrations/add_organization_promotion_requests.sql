-- Organization promotion requests (placard/sign with message). Same pricing as business ad banners (promotion_pricing).
CREATE TABLE IF NOT EXISTS public.organization_promotion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  placement text NOT NULL,
  audience_type text NOT NULL DEFAULT 'universal',
  target_genders text[] DEFAULT NULL,
  target_age_groups text[] DEFAULT NULL,
  target_languages text[] DEFAULT NULL,
  target_locations text[] DEFAULT NULL,
  image_path text,
  link_type text NOT NULL,
  link_value text,
  description text,
  tier text NOT NULL,
  duration_days int NOT NULL,
  price_cents int NOT NULL,
  status text NOT NULL DEFAULT 'pending_review',
  feed_banner_id uuid REFERENCES public.feed_banners(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organization_promotion_requests IS 'Promotion placard/sign requests from organizations (events, messages); same Stripe pricing as business ad banners.';
COMMENT ON COLUMN public.organization_promotion_requests.placement IS 'home_feed | community | universal';
COMMENT ON COLUMN public.organization_promotion_requests.link_type IS 'organization_page | external';
COMMENT ON COLUMN public.organization_promotion_requests.status IS 'pending_review | approved | rejected | active | expired';

ALTER TABLE public.organization_promotion_requests
  ADD CONSTRAINT organization_promotion_requests_placement_check
  CHECK (placement IN ('home_feed', 'community', 'universal'));
ALTER TABLE public.organization_promotion_requests
  ADD CONSTRAINT organization_promotion_requests_link_type_check
  CHECK (link_type IN ('organization_page', 'external'));
ALTER TABLE public.organization_promotion_requests
  ADD CONSTRAINT organization_promotion_requests_tier_check
  CHECK (tier IN ('basic', 'targeted', 'premium'));
ALTER TABLE public.organization_promotion_requests
  ADD CONSTRAINT organization_promotion_requests_status_check
  CHECK (status IN ('pending_review', 'approved', 'rejected', 'active', 'expired'));
ALTER TABLE public.organization_promotion_requests
  ADD CONSTRAINT organization_promotion_requests_audience_type_check
  CHECK (audience_type IN ('universal', 'targeted'));

CREATE INDEX IF NOT EXISTS organization_promotion_requests_organization_id ON public.organization_promotion_requests (organization_id);
CREATE INDEX IF NOT EXISTS organization_promotion_requests_status ON public.organization_promotion_requests (status);
