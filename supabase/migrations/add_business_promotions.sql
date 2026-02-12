-- Promotion pricing: tier × duration → price (USD cents)
CREATE TABLE IF NOT EXISTS public.promotion_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier text NOT NULL,
  duration_days int NOT NULL,
  price_cents int NOT NULL,
  label text,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE(tier, duration_days)
);

COMMENT ON TABLE public.promotion_pricing IS 'Pricing for business promotion banners: basic, targeted, premium × duration.';

-- Business promotion requests (submitted by business; admin approves → creates feed_banner)
CREATE TABLE IF NOT EXISTS public.business_promotion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  placement text NOT NULL,
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

COMMENT ON TABLE public.business_promotion_requests IS 'Promotion banner requests from businesses; admin approves to create feed_banner.';
COMMENT ON COLUMN public.business_promotion_requests.placement IS 'home_feed | community | universal';
COMMENT ON COLUMN public.business_promotion_requests.link_type IS 'business_page | external';
COMMENT ON COLUMN public.business_promotion_requests.status IS 'pending_review | approved | rejected | active | expired';

ALTER TABLE public.business_promotion_requests
  ADD CONSTRAINT business_promotion_requests_placement_check
  CHECK (placement IN ('home_feed', 'community', 'universal'));
ALTER TABLE public.business_promotion_requests
  ADD CONSTRAINT business_promotion_requests_link_type_check
  CHECK (link_type IN ('business_page', 'external'));
ALTER TABLE public.business_promotion_requests
  ADD CONSTRAINT business_promotion_requests_tier_check
  CHECK (tier IN ('basic', 'targeted', 'premium'));
ALTER TABLE public.business_promotion_requests
  ADD CONSTRAINT business_promotion_requests_status_check
  CHECK (status IN ('pending_review', 'approved', 'rejected', 'active', 'expired'));

CREATE INDEX IF NOT EXISTS business_promotion_requests_business_id ON public.business_promotion_requests (business_id);
CREATE INDEX IF NOT EXISTS business_promotion_requests_status ON public.business_promotion_requests (status);

-- Seed pricing: BASIC, TARGETED, PREMIUM × 14, 30, 90, 180, 365 days
INSERT INTO public.promotion_pricing (tier, duration_days, price_cents, label, sort_order) VALUES
  ('basic', 14, 2900, '2 Weeks', 10),
  ('basic', 30, 4900, '1 Month', 20),
  ('basic', 90, 11900, '3 Months', 30),
  ('basic', 180, 19900, '6 Months', 40),
  ('basic', 365, 34900, '1 Year', 50),
  ('targeted', 14, 4900, '2 Weeks', 10),
  ('targeted', 30, 7900, '1 Month', 20),
  ('targeted', 90, 19900, '3 Months', 30),
  ('targeted', 180, 32900, '6 Months', 40),
  ('targeted', 365, 54900, '1 Year', 50),
  ('premium', 14, 6900, '2 Weeks', 10),
  ('premium', 30, 10900, '1 Month', 20),
  ('premium', 90, 26900, '3 Months', 30),
  ('premium', 180, 44900, '6 Months', 40),
  ('premium', 365, 74900, '1 Year', 50)
ON CONFLICT (tier, duration_days) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;
