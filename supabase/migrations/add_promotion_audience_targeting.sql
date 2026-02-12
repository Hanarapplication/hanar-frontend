-- Audience targeting for promotions: universal (everyone) vs targeted (gender, age, location, language).

-- business_promotion_requests: business chooses audience when submitting
ALTER TABLE public.business_promotion_requests
  ADD COLUMN IF NOT EXISTS audience_type text NOT NULL DEFAULT 'universal',
  ADD COLUMN IF NOT EXISTS target_genders text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_age_groups text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_languages text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_locations text[] DEFAULT NULL;

COMMENT ON COLUMN public.business_promotion_requests.audience_type IS 'universal = show to everyone; targeted = filter by target_* columns';
COMMENT ON COLUMN public.business_promotion_requests.target_genders IS 'When targeted: man, woman, she, he, they (null or empty = any)';
COMMENT ON COLUMN public.business_promotion_requests.target_age_groups IS 'When targeted: 13-17, 18-24, 25-34, 35-44, 45-54, 55+ (null or empty = any)';
COMMENT ON COLUMN public.business_promotion_requests.target_languages IS 'When targeted: language codes e.g. en, ar, es (null or empty = any)';
COMMENT ON COLUMN public.business_promotion_requests.target_locations IS 'When targeted: state/region codes or city names (null or empty = any)';

ALTER TABLE public.business_promotion_requests
  DROP CONSTRAINT IF EXISTS business_promotion_requests_audience_type_check;
ALTER TABLE public.business_promotion_requests
  ADD CONSTRAINT business_promotion_requests_audience_type_check
  CHECK (audience_type IN ('universal', 'targeted'));

-- feed_banners: copy from promotion on approve so feed API can filter
ALTER TABLE public.feed_banners
  ADD COLUMN IF NOT EXISTS audience_type text NOT NULL DEFAULT 'universal',
  ADD COLUMN IF NOT EXISTS target_genders text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_age_groups text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_languages text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_locations text[] DEFAULT NULL;

COMMENT ON COLUMN public.feed_banners.audience_type IS 'universal = show to all; targeted = filter by target_*';
ALTER TABLE public.feed_banners
  DROP CONSTRAINT IF EXISTS feed_banners_audience_type_check;
ALTER TABLE public.feed_banners
  ADD CONSTRAINT feed_banners_audience_type_check
  CHECK (audience_type IN ('universal', 'targeted'));
