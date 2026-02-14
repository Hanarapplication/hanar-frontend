-- Store target cities per banner in a table so we only show banners to people in those cities.
-- One row per (banner, city); used with 20-mile radius from (lat, lng) for viewer matching.

CREATE TABLE IF NOT EXISTS public.feed_banner_target_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_banner_id uuid NOT NULL REFERENCES public.feed_banners(id) ON DELETE CASCADE,
  city_label text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.feed_banner_target_cities IS 'Target cities for location-targeted feed banners; banner is shown only to viewers within 20 miles of one of these cities.';
CREATE INDEX IF NOT EXISTS feed_banner_target_cities_feed_banner_id ON public.feed_banner_target_cities (feed_banner_id);
