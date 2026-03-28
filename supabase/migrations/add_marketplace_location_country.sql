ALTER TABLE public.marketplace_items
ADD COLUMN IF NOT EXISTS location_country text;

COMMENT ON COLUMN public.marketplace_items.location_country IS 'Country from Google Places; used with state for marketplace region filters.';
