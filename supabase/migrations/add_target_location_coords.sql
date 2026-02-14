-- Store lat/lng per target city so feed can filter by "within 20 miles" of chosen cities.
-- Format: array of { "label": "City, State", "lat": 38.9, "lng": -77.0 }

ALTER TABLE public.business_promotion_requests
  ADD COLUMN IF NOT EXISTS target_location_coords jsonb DEFAULT NULL;
COMMENT ON COLUMN public.business_promotion_requests.target_location_coords IS 'When targeted: [{label, lat, lng}] for each chosen city; used for radius filtering.';

ALTER TABLE public.organization_promotion_requests
  ADD COLUMN IF NOT EXISTS target_location_coords jsonb DEFAULT NULL;
COMMENT ON COLUMN public.organization_promotion_requests.target_location_coords IS 'When targeted: [{label, lat, lng}] for each chosen city; used for radius filtering.';

ALTER TABLE public.feed_banners
  ADD COLUMN IF NOT EXISTS target_location_coords jsonb DEFAULT NULL;
COMMENT ON COLUMN public.feed_banners.target_location_coords IS 'Copied from promotion on approve; [{label, lat, lng}] for 20-mile radius targeting.';
